/**
 * Plattform-Agenten im Artifact: laufen über die Laufzeitfähigkeit „sample“ (Claude-Konto der Person).
 * Werkzeuge sind Funktionen dieser Seite (dieselben wie im Servermodus); Ergebnis sind Vorschläge.
 */
import { z } from 'zod';
import type { TgModel } from '@core/types';
import { getPlatformAgent } from '@agents/definitions';
import { toolText, toolsFor, type ToolContext } from '@agents/tools';
import { focusDigest, modelDigest, principalText } from '@agents/context';
import type { AgentTurnInput, AgentTurnResult } from '@agents/runner';

export interface AgentHooks {
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onTool?: (name: string) => void;
}

export interface AgentAvailability {
  ok: boolean;
  via: 'api' | 'sample' | 'none';
  label: string;
  hint: string;
}

interface SampleError {
  code: string;
  message: string;
  text?: string;
}

type SampleFn = ((input: unknown, options?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ maxPromptBytes: number; tools?: { maxCount: number } }>;
  json<T>(input: unknown, options?: Record<string, unknown>): Promise<T>;
};

let samplePromise: Promise<SampleFn | null> | null = null;

function getSample(): Promise<SampleFn | null> {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return Promise.resolve(null);
  samplePromise ??= claude.use('sample').then((s) => (s as SampleFn) ?? null).catch(() => null);
  return samplePromise;
}

export async function sampleAvailability(): Promise<AgentAvailability> {
  const sample = await getSample();
  if (!sample) {
    return {
      ok: false,
      via: 'none',
      label: 'Agenten nicht verfügbar',
      hint: 'Diese Seite in Claude öffnen (Agenten nutzen dann Ihr Claude-Konto) – oder die Plattform mit `npm run dev` und ANTHROPIC_API_KEY betreiben.',
    };
  }
  const limits = await sample.limits().catch(() => null);
  return {
    ok: true,
    via: 'sample',
    label: limits?.tools ? 'Claude (Ihr Konto) · mit Werkzeugen' : 'Claude (Ihr Konto)',
    hint: 'Der erste Aufruf fragt nach Ihrer Zustimmung; Aufrufe verbrauchen Ihr Claude-Kontingent. Ergebnisse sind Vorschläge.',
  };
}

const ERRORS: Record<string, string> = {
  not_granted: 'Sie haben der Seite die Nutzung von Claude nicht erlaubt.',
  sampling_disabled: 'Claude ist für dieses Konto nicht verfügbar.',
  rate_limited: 'Zu viele Anfragen oder Kontingent erreicht – bitte später erneut versuchen.',
  cancelled: 'Abgebrochen.',
  prompt_too_large: 'Die Anfrage ist zu groß – bitte enger fassen.',
  refused: 'Claude hat diese Anfrage abgelehnt – bitte umformulieren.',
  tools_unavailable: 'Werkzeuge sind in dieser Ansicht nicht verfügbar.',
};

function errorReply(e: unknown): string {
  const err = e as SampleError;
  if (err?.code && err.code !== 'cancelled' && !err.text) throw new Error(ERRORS[err.code] ?? `Agent-Fehler (${err.code}): ${err.message}`);
  return `${err?.text ?? ''}\n\n_${ERRORS[err?.code] ?? 'Unterbrochen.'}_`.trim();
}

export async function runSampleAgent(req: AgentTurnInput, model: TgModel, hooks: AgentHooks): Promise<AgentTurnResult> {
  const sample = await getSample();
  if (!sample) throw new Error('Agenten sind in dieser Ansicht nicht verfügbar.');
  const agent = getPlatformAgent(req.agentId);
  if (!agent) throw new Error(`Unbekannter Agent ${req.agentId}`);
  const limits = await sample.limits().catch(() => null);
  const principal = req.principal ?? { role: 'guest' as const, authorId: null };
  const ctx: ToolContext = { getModel: () => model, principal, actor: `Agent: ${agent.name}`, proposals: { ops: [], notes: [] } };
  const toolCalls: AgentTurnResult['toolCalls'] = [];

  const tools = toolsFor(agent.tools).map((t) => {
    const { $schema: _s, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
    return {
      name: t.name,
      description: t.description.slice(0, 1000),
      inputSchema: { type: 'object', ...schema },
      execute: async (input: Record<string, unknown>) => {
        const parsed = t.schema.safeParse(input);
        if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 3).map((x) => `${x.path.join('.')} ${x.message}`).join('; '));
        hooks.onTool?.(t.name);
        toolCalls.push({ name: t.name, ok: true });
        return toolText(await t.run(ctx, parsed.data as never), 30000);
      },
    };
  });

  const instructions = [agent.instructions, 'Deine Werkzeuge sind Funktionen der Plattform-Seite. Plane sparsam: Der Modellstand steht unten; schlage nur nach, was du wirklich brauchst.', `## Modell der Plattform\n${modelDigest(model, req.focus?.processId)}`].join('\n\n');
  const message = `${req.message}\n\n[${principalText(principal)}]${focusDigest(model, req.focus)}`;
  const turns = [{ role: 'user', content: instructions }, { role: 'assistant', content: 'Verstanden.' }, ...(req.history ?? []), { role: 'user', content: message }];

  let reply = '';
  try {
    if (limits?.tools) {
      const r = await sample(turns, { tools, signal: hooks.signal, onText: ({ text }: { text: string }) => hooks.onText?.(text), modelTier: agent.effort === 'high' ? 'complex' : 'default' });
      reply = r.text + (r.truncated ? '\n\n_(Antwort gekürzt.)_' : '');
    } else {
      // Ohne Werkzeuge: Vorschlag als JSON in der Antwort
      const out = await sample.json<{ reply?: string; draft?: unknown; assessments?: unknown[] }>(
        [
          ...turns.slice(0, -1),
          {
            role: 'user',
            content: `${message}\n\nAntworte nur mit JSON: {"reply": "Antwort (Deutsch, Markdown)"${agent.id === 'story-assistent' ? ', "draft": {type, target, category, title, note, story?: {role, goal, benefit, acceptanceCriteria: [{given, when, then}]}, nodeIds, sapAgentIds, priority?, businessValue?} oder null' : ''}${agent.id === 'abgleich-agent' ? ', "assessments": [{requirementId, fit, summary, rationale, nodeIds, sapAgentIds, standardReference, recommendation, verify}]' : ''}}`,
          },
        ],
        { signal: hooks.signal, cache: false },
      );
      reply = String(out.reply ?? '');
      const byName = Object.fromEntries(toolsFor(agent.tools).map((t) => [t.name, t]));
      if (out.draft && byName.propose_draft) {
        const p = byName.propose_draft.schema.safeParse(out.draft);
        if (p.success) byName.propose_draft.run(ctx, p.data as never);
      }
      for (const a of out.assessments ?? []) {
        const p = byName.propose_assessment?.schema.safeParse(a);
        if (p?.success) byName.propose_assessment.run(ctx, p.data as never);
      }
    }
  } catch (e) {
    reply = errorReply(e);
  }
  return {
    agentId: agent.id,
    reply: reply || (ctx.proposals.ops.length || ctx.proposals.draft ? 'Vorschlag liegt bereit.' : 'Keine Antwort erhalten.'),
    ops: ctx.proposals.ops,
    draft: ctx.proposals.draft,
    notes: ctx.proposals.notes,
    toolCalls,
    stopReason: null,
  };
}
