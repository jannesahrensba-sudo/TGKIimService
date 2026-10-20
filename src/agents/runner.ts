/**
 * Führt einen Plattform-Agenten über die Claude API aus (Servermodus, Tool Runner).
 * Ergebnis: Antwort plus Vorschläge (Entwurf einer Anforderung oder Change-Set) – übernommen wird
 * in der Oberfläche durch die Person selbst, mit ihren Rechten.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { TgModel } from '../core/types';
import type { Op, RequirementDraft } from '../core/ops';
import type { Principal } from '../core/access';
import { getPlatformAgent } from './definitions';
import { toolText, toolsFor, type ToolContext } from './tools';
import { focusDigest, modelDigest, principalText, type AgentFocus } from './context';

export const AGENT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5-5';

export interface AgentTurnInput {
  agentId: string;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  focus?: AgentFocus;
  principal?: Principal;
}

export interface AgentTurnResult {
  agentId: string;
  reply: string;
  ops: Op[];
  draft?: RequirementDraft;
  notes: string[];
  toolCalls: { name: string; ok: boolean; detail?: string }[];
  stopReason: string | null;
}

export function agentStatus() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
  return { configured, model: AGENT_MODEL };
}

export async function runAgentTurn(input: AgentTurnInput, deps: { model: TgModel; client?: Anthropic }): Promise<AgentTurnResult> {
  const agent = getPlatformAgent(input.agentId);
  if (!agent) throw new Error(`Unbekannter Agent ${input.agentId}`);
  const client = deps.client ?? new Anthropic();
  const principal: Principal = input.principal ?? { role: 'guest', authorId: null };
  const ctx: ToolContext = { getModel: () => deps.model, principal, actor: `Agent: ${agent.name}`, proposals: { ops: [], notes: [] } };
  const toolCalls: AgentTurnResult['toolCalls'] = [];

  const tools = toolsFor(agent.tools).map((t) =>
    betaZodTool({
      name: t.name,
      description: t.description,
      inputSchema: t.schema as never,
      run: async (args: unknown) => {
        try {
          const out = await t.run(ctx, args as never);
          toolCalls.push({ name: t.name, ok: true });
          return toolText(out);
        } catch (e) {
          toolCalls.push({ name: t.name, ok: false, detail: (e as Error).message });
          return `Fehler: ${(e as Error).message}`;
        }
      },
    }),
  );

  const runner = client.beta.messages.toolRunner({
    model: AGENT_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: agent.effort },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    max_iterations: 16,
    system: [
      { type: 'text', text: agent.instructions },
      { type: 'text', text: `# Modell der Plattform (Stand der Sitzung)\n${modelDigest(deps.model, input.focus?.processId)}`, cache_control: { type: 'ephemeral' } },
    ],
    tools,
    messages: [
      ...(input.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: `${input.message}\n\n[${principalText(principal)}]${focusDigest(deps.model, input.focus)}` },
    ],
  } as never);

  const final = (await runner) as Anthropic.Beta.BetaMessage;
  let reply = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim();
  if (final.stop_reason === 'refusal') reply = 'Der Agent hat diese Anfrage abgelehnt – bitte umformulieren.';
  else if (final.stop_reason === 'max_tokens') reply += '\n\n_(Antwort wegen Längenbegrenzung gekürzt.)_';
  else if (!reply) reply = ctx.proposals.ops.length || ctx.proposals.draft ? 'Vorschlag liegt bereit.' : 'Keine Antwort erhalten.';

  return { agentId: agent.id, reply, ops: ctx.proposals.ops, draft: ctx.proposals.draft, notes: ctx.proposals.notes, toolCalls, stopReason: final.stop_reason };
}

/** SDK-Fehler in verständliche Meldungen übersetzen (typisierte Fehlerklassen) */
export function describeAgentError(e: unknown): { status: number; message: string } {
  if (e instanceof Anthropic.AuthenticationError) return { status: 401, message: 'Claude-API: Anmeldung fehlgeschlagen – ANTHROPIC_API_KEY prüfen (oder `ant auth login`).' };
  if (e instanceof Anthropic.PermissionDeniedError) return { status: 403, message: 'Claude-API: keine Berechtigung für das Modell.' };
  if (e instanceof Anthropic.RateLimitError) return { status: 429, message: 'Claude-API: Rate-Limit erreicht – bitte kurz warten.' };
  if (e instanceof Anthropic.BadRequestError) return { status: 400, message: `Claude-API: ungültige Anfrage – ${e.message}` };
  if (e instanceof Anthropic.APIConnectionError) return { status: 502, message: 'Claude-API nicht erreichbar (Netzwerk/Proxy).' };
  if (e instanceof Anthropic.APIError) return { status: e.status ?? 500, message: `Claude-API-Fehler ${e.status ?? ''}: ${e.message}` };
  return { status: 500, message: (e as Error).message ?? String(e) };
}
