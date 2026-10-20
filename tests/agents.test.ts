/** Agenten-Werkzeuge (Vorschläge statt Änderungen) und Server-Runner mit nachgebildetem Client. */
import { describe, expect, it } from 'vitest';
import { toolsFor, PLATFORM_TOOLS, type ToolContext } from '../src/agents/tools';
import { PLATFORM_AGENTS } from '../src/agents/definitions';
import { modelDigest } from '../src/agents/context';
import { AGENT_MODEL, runAgentTurn } from '../src/agents/runner';
import { bundled, memberA, moderation } from './helpers';

const ctxFor = async (principal = memberA): Promise<ToolContext> => {
  const m = await bundled();
  return { getModel: () => m, principal, actor: 'Agent: Test', proposals: { ops: [], notes: [] } };
};
const run = (ctx: ToolContext, name: string, input: unknown) => {
  const t = PLATFORM_TOOLS.find((x) => x.name === name)!;
  return t.run(ctx, t.schema.parse(input) as never);
};

describe('Agenten-Werkzeuge', () => {
  it('jeder Agent nutzt nur vorhandene Werkzeuge', () => {
    for (const a of PLATFORM_AGENTS) expect(toolsFor(a.tools).map((t) => t.name).sort()).toEqual([...a.tools].sort());
  });

  it('propose_draft legt einen Entwurf ab und verwirft unbekannte IDs', async () => {
    const ctx = await ctxFor();
    const r = run(ctx, 'propose_draft', { type: 'USER_STORY', target: 'SAP_AGENT', category: 'Auftragsdisposition', title: 'Zuteilung', note: '', story: { role: 'Disponent', goal: 'Vorschlag', benefit: 'schneller', acceptanceCriteria: [] }, nodeIds: ['F03', 'X1'], sapAgentIds: ['AG_DISPATCH'] }) as { droppedUnknownIds: string[] };
    expect(r.droppedUnknownIds).toEqual(['X1']);
    expect(ctx.proposals.draft?.nodeIds).toEqual(['F03']);
  });

  it('propose_assessment erzeugt eine geprüfte review.assess-Operation', async () => {
    const ctx = await ctxFor();
    expect((run(ctx, 'propose_assessment', { requirementId: 'ANF-009', fit: 'GAP', summary: 's', rationale: 'r', nodeIds: ['E02'], sapAgentIds: [], standardReference: '', recommendation: '', verify: [] }) as { ok: boolean }).ok).toBe(true);
    expect(ctx.proposals.ops[0]).toMatchObject({ op: 'review.assess', requirementId: 'ANF-009' });
    expect((run(ctx, 'propose_assessment', { requirementId: 'ANF-999', fit: 'GAP', summary: 's', rationale: 'r', nodeIds: [], sapAgentIds: [], standardReference: '', recommendation: '', verify: [] }) as { ok: boolean }).ok).toBe(false);
  });

  it('propose_changes nur für die Moderation und nur erlaubte Operationen', async () => {
    const member = await ctxFor();
    expect(run(member, 'propose_changes', { summary: 'x', ops: [{ op: 'agent.link', agentId: 'AG_DEBRIEF', nodeId: 'E15' }] })).toMatchObject({ ok: false });
    const mod = await ctxFor(moderation);
    expect(run(mod, 'propose_changes', { summary: 'x', ops: [{ op: 'review.setStatus', requirementId: 'ANF-001', status: 'ABGELEHNT' }] })).toMatchObject({ ok: false });
    run(mod, 'propose_changes', { summary: 'verorten', ops: [{ op: 'agent.link', agentId: 'AG_DEBRIEF', nodeId: 'E15' }] });
    expect(mod.proposals.ops).toHaveLength(1);
  });

  it('Kontext enthält Prozess, Agenten und Anforderungen kompakt', async () => {
    const d = modelDigest(await bundled());
    expect(d).toContain('E15');
    expect(d).toContain('AG_IHS_PROC');
    expect(d).toContain('ANF-001');
    expect(d.length).toBeLessThan(60000);
  });
});

describe('Server-Runner', () => {
  it('liefert Antwort und Vorschläge (Client nachgebildet)', async () => {
    const m = await bundled();
    let params: Record<string, unknown> = {};
    const client = {
      beta: {
        messages: {
          toolRunner: (p: Record<string, unknown>) => {
            params = p;
            return Promise.resolve({ content: [{ type: 'text', text: 'Der In-House Service beginnt mit dem Retourenauftrag.' }], stop_reason: 'end_turn' });
          },
        },
      },
    };
    const r = await runAgentTurn({ agentId: 'prozess-agent', message: 'Wie startet der In-House Service?', principal: memberA, focus: { nodeId: 'E12' } }, { model: m, client: client as never });
    expect(r.reply).toContain('Retourenauftrag');
    expect(params).toMatchObject({ model: AGENT_MODEL, thinking: { type: 'adaptive' }, fallbacks: 'default' });
    const msgs = params.messages as { content: string }[];
    expect(msgs.at(-1)?.content).toContain('Ausgewählter Schritt');
  });
});
