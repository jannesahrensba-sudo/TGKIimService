/**
 * Werkzeuge der Plattform-Agenten – einmal definiert (Zod), genutzt im Browser (Laufzeitfähigkeit „sample“)
 * und auf dem Server (Claude API, Tool Runner). Lesende Werkzeuge liefern kompakte Sichten; schreibende
 * Werkzeuge (propose_*) erzeugen nur Vorschläge: einen Entwurf oder ein Change-Set.
 */
import { z } from 'zod';
import type { TgModel } from '../core/types';
import { AGENT_STATUS, FIT_RESULTS, PRIORITIES, REQUIREMENT_TARGETS, REQUIREMENT_TYPES } from '../core/types';
import { applyOps, type Op, type RequirementDraft } from '../core/ops';
import { MODERATION, type Principal } from '../core/access';
import { agentDetails, coverageReport, listRequirements, overview, processOutline, requirementDetails, search, stepDetails } from '../core/queries';
import { quickMatch } from '../core/match';

export interface ToolContext {
  getModel(): TgModel;
  principal: Principal;
  actor: string;
  /** Gesammelte Vorschläge dieses Gesprächsschritts */
  proposals: { ops: Op[]; draft?: RequirementDraft; notes: string[] };
}

export interface PlatformTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run(ctx: ToolContext, input: z.infer<S>): unknown;
}

const tool = <S extends z.ZodType>(t: PlatformTool<S>) => t as unknown as PlatformTool;

const fitValues = Object.keys(FIT_RESULTS) as [string, ...string[]];
const typeValues = Object.keys(REQUIREMENT_TYPES) as [string, ...string[]];
const targetValues = Object.keys(REQUIREMENT_TARGETS) as [string, ...string[]];
const priorityValues = Object.keys(PRIORITIES) as [string, ...string[]];
const statusValues = Object.keys(AGENT_STATUS) as [string, ...string[]];

const ac = z.object({ given: z.string(), when: z.string(), then: z.string() });

/** Vorschläge auf einem Entwurf anwenden (Prüfung wie beim Übernehmen, aber mit den Rechten der Moderation) */
function tryOps(ctx: ToolContext, ops: Op[], principal: Principal) {
  const res = applyOps(ctx.getModel(), ops, { actor: ctx.actor, principal });
  return res.results.map((r) => ({ ok: r.ok, message: r.message }));
}

const ALLOWED_CHANGE_OPS = new Set(['gap.add', 'gap.update', 'agent.link', 'agent.unlink', 'process.updateNode', 'agent.update']);

export const PLATFORM_TOOLS: PlatformTool[] = [
  tool({
    name: 'get_overview',
    description: 'Überblick: TG-Phase, Prozesse mit Agentenabdeckung, Anzahl SAP-Agenten je Status, Agentenlücken, Anforderungen je Status und Unternehmen.',
    schema: z.object({}),
    run: (ctx) => overview(ctx.getModel()),
  }),
  tool({
    name: 'get_process',
    description: 'Prozess als Schrittliste: ID, Typ, Name, Lane (Rolle), Bereich, Nachfolger, SAP-Agenten mit Status, Abdeckung, Anforderungen und Lücken je Schritt.',
    schema: z.object({ processId: z.string().optional().describe('Standard: E2E-Serviceprozess') }),
    run: (ctx, i) => processOutline(ctx.getModel(), i.processId),
  }),
  tool({
    name: 'get_step',
    description: 'Ein Prozessschritt im Detail: SAP-Standardbeschreibung, Objekte, Apps, Scope Items, Quellen, Vorgänger/Nachfolger, SAP-Agenten (Status, Produkt, Beschreibung), Anforderungen, Agentenlücken.',
    schema: z.object({ nodeId: z.string().describe('z. B. E15') }),
    run: (ctx, i) => stepDetails(ctx.getModel(), i.nodeId) ?? `Schritt ${i.nodeId} nicht gefunden`,
  }),
  tool({
    name: 'list_sap_agents',
    description: 'SAP-Agenten und KI-Funktionen kompakt (ID, Name, Bereich, Produkt, Status, Verortung). Filter optional.',
    schema: z.object({ areaId: z.string().optional(), status: z.enum(statusValues).optional(), text: z.string().optional() }),
    run: (ctx, i) => {
      const m = ctx.getModel();
      const q = i.text?.toLowerCase();
      return m.sapAgents
        .filter((a) => !i.areaId || a.areaId === i.areaId)
        .filter((a) => !i.status || a.status === i.status)
        .filter((a) => !q || `${a.name} ${a.description} ${a.keywords.join(' ')}`.toLowerCase().includes(q))
        .map((a) => `${a.id} | ${a.name} | ${a.areaId} | ${a.product} | ${AGENT_STATUS[a.status].label}${a.availability ? ` (${a.availability})` : ''} | Schritte: ${a.nodeIds.join(', ') || '–'}`);
    },
  }),
  tool({
    name: 'get_sap_agent',
    description: 'Ein SAP-Agent im Detail: Beschreibung, Fähigkeiten, Status/Verfügbarkeit, frühere Namen (Kick-off), Assistent, Prozessschritte, Anforderungen der Unternehmen, Quellen.',
    schema: z.object({ agentId: z.string() }),
    run: (ctx, i) => agentDetails(ctx.getModel(), i.agentId) ?? `Agent ${i.agentId} nicht gefunden`,
  }),
  tool({
    name: 'coverage_report',
    description: 'Agentenabdeckung je Schritt: verfügbar / geplant / Lücke / ohne Agent, offene Bedarfe, dokumentierte Agentenlücken, Agenten ohne Prozessbezug.',
    schema: z.object({ processId: z.string().optional() }),
    run: (ctx, i) => coverageReport(ctx.getModel(), i.processId),
  }),
  tool({
    name: 'list_requirements',
    description: 'Anforderungen der Unternehmen (ID, Unternehmen, Art, Bezug, Kategorie, Titel, Status, Abgleich, Unterstützer). Filter optional.',
    schema: z.object({ company: z.string().optional(), status: z.string().optional(), category: z.string().optional(), text: z.string().optional(), nodeId: z.string().optional(), agentId: z.string().optional() }),
    run: (ctx, i) => listRequirements(ctx.getModel(), i).slice(0, 120),
  }),
  tool({
    name: 'get_requirement',
    description: 'Eine Anforderung vollständig: Inhalt, User Story, Bewertung/Status mit Historie, Abgleich, Kommentare, Unterstützer, Schnellabgleich-Vorschlag.',
    schema: z.object({ requirementId: z.string() }),
    run: (ctx, i) => requirementDetails(ctx.getModel(), i.requirementId) ?? `Anforderung ${i.requirementId} nicht gefunden`,
  }),
  tool({
    name: 'search',
    description: 'Volltextsuche über Schritte, SAP-Agenten, Anforderungen, Lücken und Quellen.',
    schema: z.object({ query: z.string() }),
    run: (ctx, i) => search(ctx.getModel(), i.query),
  }),
  tool({
    name: 'quick_match',
    description: 'Stichwortabgleich (ohne KI) eines Textes mit Schritten und SAP-Agenten: erkannte Fachbegriffe, Kandidaten mit Score, Vorschlag für den Abgleich.',
    schema: z.object({ title: z.string(), note: z.string().optional(), target: z.enum(targetValues).optional() }),
    run: (ctx, i) => {
      const q = quickMatch(ctx.getModel(), { title: i.title, note: i.note ?? '', category: '', target: (i.target ?? 'NEUER_AGENT') as never, nodeIds: [], sapAgentIds: [] });
      return { concepts: q.concepts, steps: q.nodes.slice(0, 5), agents: q.agents.slice(0, 5), proposal: { fit: q.proposal.fit, nodeIds: q.proposal.nodeIds, sapAgentIds: q.proposal.sapAgentIds } };
    },
  }),
  tool({
    name: 'propose_draft',
    description: 'Entwurf einer Anforderung für das Formular im Anforderungsportal ablegen (wird nicht eingereicht). Bei type USER_STORY sind story.role, story.goal, story.benefit und Akzeptanzkriterien anzugeben.',
    schema: z.object({
      type: z.enum(typeValues),
      target: z.enum(targetValues),
      category: z.string(),
      title: z.string(),
      note: z.string().describe('Beschreibung bzw. Anmerkung'),
      story: z.object({ role: z.string(), goal: z.string(), benefit: z.string(), acceptanceCriteria: z.array(ac) }).optional(),
      nodeIds: z.array(z.string()).optional(),
      sapAgentIds: z.array(z.string()).optional(),
      priority: z.enum(priorityValues).optional(),
      businessValue: z.string().optional(),
    }),
    run: (ctx, i) => {
      const m = ctx.getModel();
      const nodeIds = (i.nodeIds ?? []).filter((id) => m.processes.some((p) => p.nodes.some((n) => n.id === id)));
      const sapAgentIds = (i.sapAgentIds ?? []).filter((id) => m.sapAgents.some((a) => a.id === id));
      const dropped = [...(i.nodeIds ?? []).filter((x) => !nodeIds.includes(x)), ...(i.sapAgentIds ?? []).filter((x) => !sapAgentIds.includes(x))];
      ctx.proposals.draft = { ...(i as RequirementDraft), nodeIds, sapAgentIds };
      return { ok: true, message: 'Entwurf liegt im Formular bereit.', droppedUnknownIds: dropped };
    },
  }),
  tool({
    name: 'propose_assessment',
    description: 'Abgleich-Ergebnis für eine Anforderung vorschlagen (wird als Vorschlag der Moderation vorgelegt). fit: STANDARD | SAP_AGENT_VERFUEGBAR | SAP_AGENT_GEPLANT | TEIL_FIT | GAP | OFFEN.',
    schema: z.object({
      requirementId: z.string(),
      fit: z.enum(fitValues),
      summary: z.string().describe('Kurzfazit, ein Satz'),
      rationale: z.string(),
      nodeIds: z.array(z.string()),
      sapAgentIds: z.array(z.string()),
      standardReference: z.string(),
      recommendation: z.string(),
      verify: z.array(z.string()),
    }),
    run: (ctx, i) => {
      const { requirementId, ...rest } = i as { requirementId: string } & Record<string, unknown>;
      const op = { op: 'review.assess', requirementId, assessment: { ...rest, assessedBy: ctx.actor, marker: 'ABGELEITET' } } as unknown as Op;
      const [r] = tryOps(ctx, [op], MODERATION);
      if (!r.ok) return { ok: false, message: r.message };
      ctx.proposals.ops = ctx.proposals.ops.filter((o) => !(o.op === 'review.assess' && o.requirementId === requirementId));
      ctx.proposals.ops.push(op);
      return { ok: true, message: `Abgleich für ${requirementId} vorgeschlagen` };
    },
  }),
  tool({
    name: 'propose_changes',
    description: 'Nur für die Moderation: Änderungen am Board vorschlagen. Erlaubt: gap.add {gap:{title,nodeIds,description,proposedAgent,benefit,requirementIds?}}, gap.update {gapId,patch}, agent.link/agent.unlink {agentId,nodeId}, agent.update {agentId,patch:{note?,status?,availability?}}, process.updateNode {processId,nodeId,patch:{description?,note?,marker?,keywords?}}.',
    schema: z.object({ summary: z.string(), ops: z.array(z.record(z.string(), z.unknown())) }),
    run: (ctx, i) => {
      if (ctx.principal.role !== 'moderation') return { ok: false, message: 'Änderungen am Board schlägt nur die Moderation vor – bitte im Anforderungsportal einreichen.' };
      const ops = i.ops as unknown as Op[];
      const bad = ops.filter((o) => !ALLOWED_CHANGE_OPS.has(String(o.op)));
      if (bad.length) return { ok: false, message: `Nicht erlaubt: ${bad.map((o) => o.op).join(', ')}` };
      const results = tryOps(ctx, ops, ctx.principal);
      ops.forEach((o, k) => results[k]?.ok && ctx.proposals.ops.push(o));
      ctx.proposals.notes.push(i.summary);
      return results;
    },
  }),
];

export const toolsFor = (names: string[]) => PLATFORM_TOOLS.filter((t) => names.includes(t.name));

/** Ergebnis als Text (kompakt, begrenzt) */
export function toolText(v: unknown, max = 28000): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)} … (gekürzt)` : s;
}
