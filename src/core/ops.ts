/**
 * Änderungsoperationen auf dem Modell. Jede Änderung – aus Portal, Board, Server, MCP oder von Agenten –
 * läuft über applyOps: Rechteprüfung je Operation (access.ts), Validierung, Historie.
 * Fehlerhafte oder nicht erlaubte Operationen werden mit Grund abgelehnt, die übrigen angewendet.
 */
import type {
  AgentGap,
  AgentStatus,
  Assessment,
  AreaId,
  FitResult,
  GapStatus,
  Lane,
  Marker,
  NodeType,
  Priority,
  ProcessModel,
  ProcessNode,
  ReqStatus,
  Requirement,
  RequirementReview,
  RequirementTarget,
  RequirementType,
  SapAgent,
  SequenceFlow,
  Source,
  TgModel,
  TgPhaseId,
  UserStoryContent,
} from './types';
import { AGENT_STATUS, FIT_RESULTS, GAP_STATUS, MARKERS, NODE_TYPES, PRIORITIES, REQ_STATUS, REQUIREMENT_TARGETS, REQUIREMENT_TYPES, SEED_AUTHOR, isGateway } from './types';
import { checkOp, type Principal } from './access';
import { cloneModel } from './model-io';

export interface RequirementDraft {
  type: RequirementType;
  target: RequirementTarget;
  category: string;
  title: string;
  note: string;
  story?: UserStoryContent;
  nodeIds?: string[];
  sapAgentIds?: string[];
  priority?: Priority;
  businessValue?: string;
  source?: string;
}

export type AssessmentInput = Omit<Assessment, 'assessedAt' | 'confirmed' | 'marker'> & { confirmed?: boolean; marker?: Marker };

export type GapInput = Pick<AgentGap, 'title' | 'nodeIds' | 'description' | 'proposedAgent' | 'benefit'> & Partial<Pick<AgentGap, 'requirementIds' | 'status' | 'origin' | 'marker'>>;

export type AgentInput = Pick<SapAgent, 'name' | 'areaId' | 'product' | 'status' | 'description'> &
  Partial<Pick<SapAgent, 'id' | 'kind' | 'assistantId' | 'availability' | 'capabilities' | 'roles' | 'nodeIds' | 'keywords' | 'sourceIds' | 'marker' | 'note'>>;

export type NodeInput = Pick<ProcessNode, 'type' | 'name' | 'laneId'> &
  Partial<Pick<ProcessNode, 'id' | 'areaId' | 'description' | 'systemIds' | 'objects' | 'apps' | 'scopeItems' | 'sourceIds' | 'customerInbound' | 'customerOutbound' | 'keywords' | 'note' | 'marker'>>;

export type Op =
  | { op: 'profile.set'; name: string; company: string }
  | { op: 'requirement.submit'; requirement: RequirementDraft }
  | { op: 'requirement.update'; requirementId: string; patch: Partial<RequirementDraft> }
  | { op: 'requirement.withdraw'; requirementId: string; withdrawn?: boolean; reason?: string }
  | { op: 'comment.add'; requirementId: string; text: string }
  | { op: 'comment.remove'; commentId: string }
  | { op: 'support.set'; requirementId: string; on: boolean }
  | { op: 'review.setStatus'; requirementId: string; status: ReqStatus; note?: string }
  | { op: 'review.assess'; requirementId: string; assessment: AssessmentInput }
  | { op: 'review.confirm'; requirementId: string; confirmed: boolean; note?: string }
  | { op: 'review.update'; requirementId: string; patch: { tgPriority?: number | null; sapFeedback?: string; gapId?: string | null } }
  | { op: 'gap.add'; gap: GapInput }
  | { op: 'gap.update'; gapId: string; patch: Partial<GapInput> }
  | { op: 'gap.remove'; gapId: string }
  | { op: 'agent.add'; agent: AgentInput }
  | { op: 'agent.update'; agentId: string; patch: Partial<AgentInput> }
  | { op: 'agent.link'; agentId: string; nodeId: string }
  | { op: 'agent.unlink'; agentId: string; nodeId: string }
  | { op: 'process.add'; process: { id?: string; code: string; name: string; description: string; scope?: string } }
  | { op: 'process.updateNode'; processId: string; nodeId: string; patch: Partial<NodeInput> }
  | { op: 'process.addNode'; processId: string; node: NodeInput; after?: string }
  | { op: 'process.removeNode'; processId: string; nodeId: string; reconnect?: boolean }
  | { op: 'process.addFlow'; processId: string; flow: Omit<SequenceFlow, 'id'> & { id?: string } }
  | { op: 'process.updateFlow'; processId: string; flowId: string; patch: Partial<Omit<SequenceFlow, 'id'>> }
  | { op: 'process.removeFlow'; processId: string; flowId: string }
  | { op: 'process.addLane'; processId: string; lane: Lane }
  | { op: 'meta.update'; patch: { currentPhase?: TgPhaseId; categories?: string[] } }
  | { op: 'source.add'; source: Omit<Source, 'id'> & { id?: string } };

export type OpName = Op['op'];

export interface ApplyContext {
  actor: string;
  principal: Principal;
  /** Zeitstempel (Tests) */
  now?: string;
}

export interface OpResult {
  index: number;
  op: Op;
  ok: boolean;
  message: string;
  denied?: boolean;
  /** z. B. neue Anforderungs-ID */
  createdId?: string;
}

export interface ApplyResult {
  model: TgModel;
  results: OpResult[];
  applied: number;
  failed: number;
}

class OpError extends Error {}
const fail = (msg: string): never => {
  throw new OpError(msg);
};

const LIMITS = { title: 200, note: 6000, text: 4000, short: 400, list: 60 };

function str(v: unknown, field: string, max: number, required = true): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) fail(`${field} fehlt`);
  if (s.length > max) fail(`${field} ist zu lang (max. ${max} Zeichen)`);
  return s;
}

function strList(v: unknown, field: string, max = LIMITS.list): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail(`${field} muss eine Liste sein`);
  const list = (v as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  if (list.length > max) fail(`${field}: höchstens ${max} Einträge`);
  return [...new Set(list)];
}

function oneOf<T extends string>(v: unknown, allowed: Record<T, unknown>, field: string): T {
  if (typeof v !== 'string' || !(v in allowed)) fail(`${field} ungültig: ${String(v)} (erlaubt: ${Object.keys(allowed).join(', ')})`);
  return v as T;
}

export const allNodes = (m: TgModel) => m.processes.flatMap((p) => p.nodes.map((n) => ({ process: p, node: n })));
const nodeExists = (m: TgModel, id: string) => m.processes.some((p) => p.nodes.some((n) => n.id === id));

function checkRefs(m: TgModel, nodeIds: string[], agentIds: string[]) {
  const badN = nodeIds.filter((id) => !nodeExists(m, id));
  if (badN.length) fail(`Unbekannte Prozessschritte: ${badN.join(', ')}`);
  const badA = agentIds.filter((id) => !m.sapAgents.some((a) => a.id === id));
  if (badA.length) fail(`Unbekannte SAP-Agenten: ${badA.join(', ')}`);
}

function sanitizeStory(v: unknown): UserStoryContent | undefined {
  if (v === undefined || v === null) return undefined;
  const s = v as UserStoryContent;
  const ac = Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria : [];
  if (ac.length > 20) fail('Höchstens 20 Akzeptanzkriterien');
  return {
    role: str(s.role, 'Rolle der User Story', LIMITS.short),
    goal: str(s.goal, 'Ziel der User Story', LIMITS.text),
    benefit: str(s.benefit, 'Nutzen der User Story', LIMITS.text),
    acceptanceCriteria: ac
      .map((c) => ({ given: str(c?.given, 'Gegeben', LIMITS.text, false), when: str(c?.when, 'Wenn', LIMITS.text, false), then: str(c?.then, 'Dann', LIMITS.text, false) }))
      .filter((c) => c.given || c.when || c.then),
  };
}

function sanitizeDraft(m: TgModel, d: Partial<RequirementDraft>, partial: boolean): Partial<Requirement> {
  const out: Partial<Requirement> = {};
  if (!partial || d.type !== undefined) out.type = oneOf(d.type, REQUIREMENT_TYPES, 'Art');
  if (!partial || d.target !== undefined) out.target = oneOf(d.target, REQUIREMENT_TARGETS, 'Bezug');
  if (!partial || d.category !== undefined) out.category = str(d.category, 'Kategorie', 120);
  if (!partial || d.title !== undefined) out.title = str(d.title, 'Titel', LIMITS.title);
  if (!partial || d.note !== undefined) out.note = str(d.note, 'Beschreibung/Anmerkung', LIMITS.note, false);
  if (!partial || d.nodeIds !== undefined) out.nodeIds = strList(d.nodeIds, 'Prozessschritte');
  if (!partial || d.sapAgentIds !== undefined) out.sapAgentIds = strList(d.sapAgentIds, 'SAP-Agenten');
  if (d.priority !== undefined) out.priority = d.priority === null ? undefined : oneOf(d.priority, PRIORITIES, 'Priorität');
  if (d.businessValue !== undefined) out.businessValue = str(d.businessValue, 'Nutzen', LIMITS.text, false) || undefined;
  if (d.source !== undefined) out.source = str(d.source, 'Herkunft', LIMITS.short, false) || undefined;
  if (d.story !== undefined) out.story = sanitizeStory(d.story);
  checkRefs(m, out.nodeIds ?? [], out.sapAgentIds ?? []);
  return out;
}

export function nextRequirementId(m: TgModel): string {
  const max = Math.max(0, ...m.requirements.map((r) => Number(/^ANF-(\d+)$/.exec(r.id)?.[1] ?? 0)));
  return `ANF-${String(max + 1).padStart(3, '0')}`;
}

/** Bewertung einer Anforderung – ohne gespeicherte Bewertung gilt „Eingereicht“. */
export function reviewOf(m: TgModel, requirementId: string): RequirementReview {
  return (
    m.reviews.find((r) => r.requirementId === requirementId) ?? {
      requirementId,
      status: 'EINGEREICHT',
      history: [],
      updatedAt: m.requirements.find((r) => r.id === requirementId)?.createdAt ?? '',
      updatedBy: '',
    }
  );
}

function ensureReview(m: TgModel, requirementId: string): RequirementReview {
  if (!m.requirements.some((r) => r.id === requirementId)) fail(`Anforderung ${requirementId} nicht gefunden`);
  let r = m.reviews.find((x) => x.requirementId === requirementId);
  if (!r) {
    r = { ...reviewOf(m, requirementId), history: [] };
    m.reviews.push(r);
  }
  return r;
}

const randomId = () => Math.random().toString(36).slice(2, 8);

function uniqueNodeId(m: TgModel, wanted?: string): string {
  if (wanted) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(wanted)) fail(`Ungültige Schritt-ID ${wanted}`);
    if (nodeExists(m, wanted)) fail(`Schritt-ID ${wanted} existiert bereits`);
    return wanted;
  }
  let i = m.processes.reduce((n, p) => n + p.nodes.length, 0) + 1;
  while (nodeExists(m, `N${i}`)) i++;
  return `N${i}`;
}

function getProcess(m: TgModel, id: string): ProcessModel {
  return m.processes.find((p) => p.id === id) ?? fail(`Prozess ${id} nicht gefunden`);
}

function getNode(p: ProcessModel, id: string): ProcessNode {
  return p.nodes.find((n) => n.id === id) ?? fail(`Schritt ${id} nicht im Prozess ${p.id}`);
}

function getAgent(m: TgModel, id: string): SapAgent {
  return m.sapAgents.find((a) => a.id === id) ?? fail(`SAP-Agent ${id} nicht gefunden`);
}

function getRequirement(m: TgModel, id: string): Requirement {
  return m.requirements.find((r) => r.id === id) ?? fail(`Anforderung ${id} nicht gefunden`);
}

function sanitizeNode(m: TgModel, p: ProcessModel, n: Partial<NodeInput>, partial: boolean): Partial<ProcessNode> {
  const out: Partial<ProcessNode> = {};
  if (!partial || n.type !== undefined) out.type = oneOf<NodeType>(n.type, NODE_TYPES, 'Knotentyp');
  if (!partial || n.name !== undefined) out.name = str(n.name, 'Name', LIMITS.title, !(out.type && isGateway(out.type)));
  if (!partial || n.laneId !== undefined) {
    out.laneId = str(n.laneId, 'Lane', 60);
    if (!p.lanes.some((l) => l.id === out.laneId)) fail(`Lane ${out.laneId} gibt es im Prozess nicht`);
  }
  if (n.areaId !== undefined || !partial) out.areaId = oneOf<AreaId>(n.areaId ?? 'PLANNING', Object.fromEntries(m.meta.areas.map((a) => [a.id, 1])) as Record<AreaId, number>, 'Bereich');
  if (n.description !== undefined || !partial) out.description = str(n.description, 'Beschreibung', LIMITS.note, false);
  for (const k of ['systemIds', 'objects', 'apps', 'scopeItems', 'sourceIds', 'keywords'] as const) if (n[k] !== undefined || !partial) out[k] = strList(n[k], k);
  if (n.customerInbound !== undefined) out.customerInbound = str(n.customerInbound, 'Nachricht vom Kunden', LIMITS.short, false) || undefined;
  if (n.customerOutbound !== undefined) out.customerOutbound = str(n.customerOutbound, 'Nachricht an den Kunden', LIMITS.short, false) || undefined;
  if (n.note !== undefined) out.note = str(n.note, 'Hinweis', LIMITS.text, false) || undefined;
  if (n.marker !== undefined || !partial) out.marker = oneOf<Marker>(n.marker ?? 'TG', MARKERS, 'Marker');
  const badSys = (out.systemIds ?? []).filter((s) => !m.meta.systems.some((x) => x.id === s));
  if (badSys.length) fail(`Unbekannte Systeme: ${badSys.join(', ')}`);
  return out;
}

function sanitizeAssessment(m: TgModel, a: AssessmentInput, actor: string, now: string, confirmedDefault: boolean): Assessment {
  const fit = oneOf<FitResult>(a.fit, FIT_RESULTS, 'Abgleich-Ergebnis');
  const nodeIds = strList(a.nodeIds, 'Prozessschritte');
  const sapAgentIds = strList(a.sapAgentIds, 'SAP-Agenten');
  checkRefs(m, nodeIds, sapAgentIds);
  return {
    fit,
    summary: str(a.summary, 'Kurzfazit', LIMITS.short),
    rationale: str(a.rationale, 'Begründung', LIMITS.note),
    nodeIds,
    sapAgentIds,
    standardReference: str(a.standardReference, 'Standardbezug', LIMITS.short, false),
    recommendation: str(a.recommendation, 'Empfehlung', LIMITS.text, false),
    verify: strList(a.verify, 'Prüfaufträge', 20),
    assessedBy: str(a.assessedBy || actor, 'Bewertet von', 120),
    assessedAt: now,
    confirmed: a.confirmed ?? confirmedDefault,
    marker: a.marker ? oneOf<Marker>(a.marker, MARKERS, 'Marker') : 'ABGELEITET',
  };
}

function applyOne(m: TgModel, op: Op, ctx: ApplyContext, now: string): { message: string; createdId?: string } {
  const p = ctx.principal;
  switch (op.op) {
    case 'profile.set': {
      const name = str(op.name, 'Name', 120);
      const company = str(op.company, 'Unternehmen', 160);
      const authorId = p.authorId ?? fail('Keine Kennung');
      const existing = m.profiles.find((x) => x.authorId === authorId);
      if (existing) Object.assign(existing, { name, company, updatedAt: now });
      else m.profiles.push({ authorId, name, company, updatedAt: now });
      return { message: `Profil: ${name} (${company})` };
    }

    case 'requirement.submit': {
      const d = sanitizeDraft(m, op.requirement ?? {}, false) as Requirement;
      if (d.type === 'USER_STORY' && !d.story) fail('User Story: Rolle, Ziel und Nutzen fehlen');
      const id = nextRequirementId(m);
      const company = p.company ?? m.profiles.find((x) => x.authorId === p.authorId)?.company ?? fail('Unternehmen fehlt');
      const author = p.name ?? m.profiles.find((x) => x.authorId === p.authorId)?.name ?? fail('Name fehlt');
      m.requirements.push({ ...d, id, authorId: p.authorId ?? fail('Keine Kennung'), author, company, createdAt: now, updatedAt: now });
      return { message: `${id} eingereicht: ${d.title}`, createdId: id };
    }

    case 'requirement.update': {
      const r = getRequirement(m, op.requirementId);
      if (r.withdrawn) fail('Zurückgezogene Anforderungen bitte erst wiederherstellen');
      const patch = sanitizeDraft(m, op.patch ?? {}, true);
      const nextType = patch.type ?? r.type;
      if (nextType === 'USER_STORY' && !(patch.story ?? r.story)) fail('User Story: Rolle, Ziel und Nutzen fehlen');
      Object.assign(r, patch, { updatedAt: now });
      if (nextType === 'PROZESSTHEMA' && op.patch.story === null) delete r.story;
      return { message: `${r.id} aktualisiert` };
    }

    case 'requirement.withdraw': {
      const r = getRequirement(m, op.requirementId);
      const on = op.withdrawn ?? true;
      r.withdrawn = on || undefined;
      r.updatedAt = now;
      if (op.reason) {
        m.comments.push({ id: `K-${randomId()}`, requirementId: r.id, authorId: p.authorId ?? '', author: p.name ?? '', company: p.company ?? '', text: `${on ? 'Zurückgezogen' : 'Wiederhergestellt'}: ${str(op.reason, 'Begründung', LIMITS.text)}`, at: now });
      }
      return { message: `${r.id} ${on ? 'zurückgezogen' : 'wiederhergestellt'}` };
    }

    case 'comment.add': {
      const r = getRequirement(m, op.requirementId);
      const id = `K-${now.replace(/\D/g, '').slice(2, 14)}-${randomId()}`;
      m.comments.push({ id, requirementId: r.id, authorId: p.authorId ?? fail('Keine Kennung'), author: p.name ?? '–', company: p.company ?? '–', text: str(op.text, 'Kommentar', LIMITS.text), at: now });
      return { message: `Kommentar zu ${r.id}`, createdId: id };
    }

    case 'comment.remove': {
      const i = m.comments.findIndex((c) => c.id === op.commentId);
      if (i < 0) fail(`Kommentar ${op.commentId} nicht gefunden`);
      m.comments.splice(i, 1);
      return { message: 'Kommentar gelöscht' };
    }

    case 'support.set': {
      const r = getRequirement(m, op.requirementId);
      const authorId = p.authorId ?? fail('Keine Kennung');
      const i = m.supports.findIndex((s) => s.requirementId === r.id && s.authorId === authorId);
      if (op.on && i < 0) m.supports.push({ requirementId: r.id, authorId, author: p.name ?? '–', company: p.company ?? '–', at: now });
      if (!op.on && i >= 0) m.supports.splice(i, 1);
      return { message: `${r.id}: ${op.on ? '„betrifft uns auch“' : 'Unterstützung entfernt'}` };
    }

    case 'review.setStatus': {
      const status = oneOf<ReqStatus>(op.status, REQ_STATUS, 'Status');
      const r = ensureReview(m, op.requirementId);
      if (status === 'RUECKFRAGE' && !op.note?.trim()) fail('Rückfrage: bitte die Frage an das Unternehmen formulieren');
      if (['PRIORISIERT', 'AN_SAP_UEBERGEBEN'].includes(status) && !r.assessment) fail('Vor Priorisierung bzw. Übergabe an SAP bitte den Abgleich durchführen');
      const note = op.note ? str(op.note, 'Notiz', LIMITS.text) : undefined;
      r.status = status;
      r.history.push({ at: now, by: ctx.actor, action: `Status: ${REQ_STATUS[status].label}`, status, note });
      Object.assign(r, { updatedAt: now, updatedBy: ctx.actor });
      // Rückfragen und Begründungen erscheinen auch im Gespräch der Anforderung
      if (note && (status === 'RUECKFRAGE' || status === 'ABGELEHNT' || status === 'ZURUECKGESTELLT')) {
        m.comments.push({ id: `K-${randomId()}`, requirementId: r.requirementId, authorId: p.authorId ?? 'moderation', author: p.name ?? 'Moderation', company: p.company ?? 'Moderation TG', text: `${REQ_STATUS[status].label}: ${note}`, at: now });
      }
      return { message: `${op.requirementId}: ${REQ_STATUS[status].label}` };
    }

    case 'review.assess': {
      const r = ensureReview(m, op.requirementId);
      r.assessment = sanitizeAssessment(m, op.assessment, ctx.actor, now, false);
      if (r.status === 'EINGEREICHT') r.status = 'IN_BEWERTUNG';
      r.history.push({ at: now, by: ctx.actor, action: `Abgleich: ${FIT_RESULTS[r.assessment.fit].label}${r.assessment.confirmed ? ' (bestätigt)' : ' (Vorschlag)'}`, note: r.assessment.summary });
      Object.assign(r, { updatedAt: now, updatedBy: ctx.actor });
      return { message: `${op.requirementId}: Abgleich ${FIT_RESULTS[r.assessment.fit].label}` };
    }

    case 'review.confirm': {
      const r = ensureReview(m, op.requirementId);
      const a = r.assessment ?? fail('Es gibt noch keinen Abgleich');
      a.confirmed = op.confirmed;
      if (op.confirmed) a.marker = 'TG';
      r.history.push({ at: now, by: ctx.actor, action: op.confirmed ? 'Abgleich bestätigt' : 'Bestätigung zurückgenommen', note: op.note });
      Object.assign(r, { updatedAt: now, updatedBy: ctx.actor });
      return { message: `${op.requirementId}: Abgleich ${op.confirmed ? 'bestätigt' : 'wieder offen'}` };
    }

    case 'review.update': {
      const r = ensureReview(m, op.requirementId);
      const patch = op.patch ?? {};
      if (patch.tgPriority !== undefined) {
        if (patch.tgPriority === null) delete r.tgPriority;
        else if (!Number.isInteger(patch.tgPriority) || patch.tgPriority < 1 || patch.tgPriority > 999) fail('TG-Priorität: ganze Zahl ab 1');
        else r.tgPriority = patch.tgPriority;
      }
      if (patch.sapFeedback !== undefined) r.sapFeedback = str(patch.sapFeedback, 'SAP-Rückmeldung', LIMITS.text, false) || undefined;
      if (patch.gapId !== undefined) {
        if (patch.gapId === null) delete r.gapId;
        else if (!m.gaps.some((g) => g.id === patch.gapId)) fail(`Lücke ${patch.gapId} nicht gefunden`);
        else r.gapId = patch.gapId;
      }
      r.history.push({ at: now, by: ctx.actor, action: 'Bewertung ergänzt', note: [patch.tgPriority != null && `TG-Priorität ${patch.tgPriority}`, patch.sapFeedback && 'SAP-Rückmeldung', patch.gapId && `Lücke ${patch.gapId}`].filter(Boolean).join(', ') || undefined });
      Object.assign(r, { updatedAt: now, updatedBy: ctx.actor });
      return { message: `${op.requirementId}: Bewertung ergänzt` };
    }

    case 'gap.add': {
      const g = op.gap;
      const nodeIds = strList(g.nodeIds, 'Prozessschritte');
      const requirementIds = strList(g.requirementIds, 'Anforderungen');
      checkRefs(m, nodeIds, []);
      for (const id of requirementIds) getRequirement(m, id);
      const max = Math.max(0, ...m.gaps.map((x) => Number(/^GAP-(\d+)$/.exec(x.id)?.[1] ?? 0)));
      const id = `GAP-${String(max + 1).padStart(2, '0')}`;
      m.gaps.push({
        id,
        title: str(g.title, 'Titel', LIMITS.title),
        nodeIds,
        description: str(g.description, 'Beschreibung', LIMITS.note),
        proposedAgent: str(g.proposedAgent, 'Vorgeschlagener Agent', LIMITS.text, false),
        benefit: str(g.benefit, 'Nutzen', LIMITS.text, false),
        requirementIds,
        status: g.status ? oneOf<GapStatus>(g.status, GAP_STATUS, 'Status') : 'IDENTIFIZIERT',
        origin: g.origin ?? 'TG',
        marker: g.marker ? oneOf<Marker>(g.marker, MARKERS, 'Marker') : 'TG',
        createdBy: ctx.actor,
        createdAt: now,
      });
      for (const rid of requirementIds) ensureReview(m, rid).gapId = id;
      return { message: `${id} angelegt`, createdId: id };
    }

    case 'gap.update': {
      const g = m.gaps.find((x) => x.id === op.gapId) ?? fail(`Lücke ${op.gapId} nicht gefunden`);
      const patch = op.patch ?? {};
      if (patch.title !== undefined) g.title = str(patch.title, 'Titel', LIMITS.title);
      if (patch.description !== undefined) g.description = str(patch.description, 'Beschreibung', LIMITS.note);
      if (patch.proposedAgent !== undefined) g.proposedAgent = str(patch.proposedAgent, 'Vorgeschlagener Agent', LIMITS.text, false);
      if (patch.benefit !== undefined) g.benefit = str(patch.benefit, 'Nutzen', LIMITS.text, false);
      if (patch.nodeIds !== undefined) {
        g.nodeIds = strList(patch.nodeIds, 'Prozessschritte');
        checkRefs(m, g.nodeIds, []);
      }
      if (patch.requirementIds !== undefined) {
        g.requirementIds = strList(patch.requirementIds, 'Anforderungen');
        for (const id of g.requirementIds) getRequirement(m, id);
      }
      if (patch.status !== undefined) g.status = oneOf<GapStatus>(patch.status, GAP_STATUS, 'Status');
      if (patch.marker !== undefined) g.marker = oneOf<Marker>(patch.marker, MARKERS, 'Marker');
      return { message: `${g.id} aktualisiert` };
    }

    case 'gap.remove': {
      const i = m.gaps.findIndex((x) => x.id === op.gapId);
      if (i < 0) fail(`Lücke ${op.gapId} nicht gefunden`);
      m.gaps.splice(i, 1);
      for (const r of m.reviews) if (r.gapId === op.gapId) delete r.gapId;
      return { message: `${op.gapId} entfernt` };
    }

    case 'agent.add': {
      const a = op.agent;
      const id = a.id?.trim() || `AG_TG_${randomId().toUpperCase()}`;
      if (!/^[A-Z][A-Z0-9_]{2,40}$/.test(id)) fail(`Ungültige Agenten-ID ${id} (Großbuchstaben, Ziffern, _)`);
      if (m.sapAgents.some((x) => x.id === id)) fail(`Agent ${id} existiert bereits`);
      const nodeIds = strList(a.nodeIds, 'Prozessschritte');
      checkRefs(m, nodeIds, []);
      m.sapAgents.push({
        id,
        name: str(a.name, 'Name', LIMITS.title),
        kind: a.kind === 'KI_FUNKTION' ? 'KI_FUNKTION' : 'AGENT',
        areaId: oneOf<AreaId>(a.areaId, Object.fromEntries(m.meta.areas.map((x) => [x.id, 1])) as Record<AreaId, number>, 'Bereich'),
        assistantId: a.assistantId && m.assistants.some((x) => x.id === a.assistantId) ? a.assistantId : undefined,
        product: str(a.product, 'Produkt', 120),
        status: oneOf<AgentStatus>(a.status, AGENT_STATUS, 'Status'),
        availability: a.availability ? str(a.availability, 'Verfügbarkeit', LIMITS.short) : undefined,
        description: str(a.description, 'Beschreibung', LIMITS.note),
        capabilities: strList(a.capabilities, 'Fähigkeiten'),
        roles: strList(a.roles, 'Rollen'),
        nodeIds,
        earlierNames: [],
        keywords: strList(a.keywords, 'Suchbegriffe'),
        sourceIds: strList(a.sourceIds, 'Quellen'),
        marker: a.marker ? oneOf<Marker>(a.marker, MARKERS, 'Marker') : 'ZU_VERIFIZIEREN',
        note: a.note ? str(a.note, 'Hinweis', LIMITS.text) : undefined,
      });
      return { message: `Agent ${id} aufgenommen`, createdId: id };
    }

    case 'agent.update': {
      const a = getAgent(m, op.agentId);
      const patch = op.patch ?? {};
      if (patch.name !== undefined) a.name = str(patch.name, 'Name', LIMITS.title);
      if (patch.product !== undefined) a.product = str(patch.product, 'Produkt', 120);
      if (patch.status !== undefined) a.status = oneOf<AgentStatus>(patch.status, AGENT_STATUS, 'Status');
      if (patch.availability !== undefined) a.availability = str(patch.availability, 'Verfügbarkeit', LIMITS.short, false) || undefined;
      if (patch.description !== undefined) a.description = str(patch.description, 'Beschreibung', LIMITS.note);
      if (patch.note !== undefined) a.note = str(patch.note, 'Hinweis', LIMITS.text, false) || undefined;
      if (patch.marker !== undefined) a.marker = oneOf<Marker>(patch.marker, MARKERS, 'Marker');
      for (const k of ['capabilities', 'roles', 'keywords', 'sourceIds'] as const) if (patch[k] !== undefined) a[k] = strList(patch[k], k);
      if (patch.nodeIds !== undefined) {
        a.nodeIds = strList(patch.nodeIds, 'Prozessschritte');
        checkRefs(m, a.nodeIds, []);
      }
      return { message: `Agent ${a.id} aktualisiert` };
    }

    case 'agent.link':
    case 'agent.unlink': {
      const a = getAgent(m, op.agentId);
      if (!nodeExists(m, op.nodeId)) fail(`Schritt ${op.nodeId} nicht gefunden`);
      if (op.op === 'agent.link') {
        if (!a.nodeIds.includes(op.nodeId)) a.nodeIds.push(op.nodeId);
      } else a.nodeIds = a.nodeIds.filter((n) => n !== op.nodeId);
      return { message: `${a.name} ${op.op === 'agent.link' ? 'verortet an' : 'gelöst von'} ${op.nodeId}` };
    }

    case 'process.add': {
      const id = (op.process.id?.trim() || op.process.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '-')).slice(0, 40);
      if (!id || m.processes.some((x) => x.id === id)) fail(`Prozess-ID ${id || '(leer)'} ungültig oder vergeben`);
      const lanes: Lane[] = [{ id: 'L_MAIN', name: 'Service', role: 'Service Planner', systemIds: [] }];
      const s = uniqueNodeId(m);
      m.processes.push({
        id,
        code: str(op.process.code, 'Kürzel', 20),
        name: str(op.process.name, 'Name', LIMITS.title),
        description: str(op.process.description, 'Beschreibung', LIMITS.note, false),
        scope: str(op.process.scope, 'Abgrenzung', LIMITS.text, false),
        version: '0.1',
        customerPool: 'Kunde',
        lanes,
        nodes: [],
        flows: [],
        sourceIds: [],
        changelog: [],
      });
      const proc = m.processes[m.processes.length - 1];
      proc.nodes.push({ id: s, type: 'startEvent', name: 'Start', laneId: 'L_MAIN', areaId: 'PLANNING', description: '', systemIds: [], objects: [], apps: [], scopeItems: [], sourceIds: [], marker: 'TG' });
      const e = uniqueNodeId(m);
      proc.nodes.push({ id: e, type: 'endEvent', name: 'Ende', laneId: 'L_MAIN', areaId: 'PLANNING', description: '', systemIds: [], objects: [], apps: [], scopeItems: [], sourceIds: [], marker: 'TG' });
      proc.flows.push({ id: `f_${s}_${e}`, from: s, to: e });
      proc.changelog.push({ at: now, by: ctx.actor, summary: 'Prozess angelegt' });
      return { message: `Prozess ${id} angelegt`, createdId: id };
    }

    case 'process.updateNode': {
      const proc = getProcess(m, op.processId);
      const n = getNode(proc, op.nodeId);
      Object.assign(n, sanitizeNode(m, proc, op.patch ?? {}, true));
      proc.changelog.push({ at: now, by: ctx.actor, summary: `${n.id} „${n.name}“ geändert` });
      return { message: `${n.id} aktualisiert` };
    }

    case 'process.addNode': {
      const proc = getProcess(m, op.processId);
      const fields = sanitizeNode(m, proc, op.node, false) as ProcessNode;
      const id = uniqueNodeId(m, op.node.id);
      const node: ProcessNode = { ...fields, id };
      proc.nodes.push(node);
      if (op.after) {
        const prev = getNode(proc, op.after);
        const outs = proc.flows.filter((f) => f.from === prev.id);
        if (outs.length > 1) fail(`${prev.id} hat mehrere Ausgänge – Fluss bitte explizit setzen`);
        if (outs[0]) outs[0].from = id;
        proc.flows.push({ id: `f_${prev.id}_${id}`, from: prev.id, to: id });
      }
      proc.changelog.push({ at: now, by: ctx.actor, summary: `Schritt ${id} „${node.name}“ ergänzt` });
      return { message: `Schritt ${id} ergänzt`, createdId: id };
    }

    case 'process.removeNode': {
      const proc = getProcess(m, op.processId);
      const n = getNode(proc, op.nodeId);
      const ins = proc.flows.filter((f) => f.to === n.id);
      const outs = proc.flows.filter((f) => f.from === n.id);
      proc.flows = proc.flows.filter((f) => f.to !== n.id && f.from !== n.id);
      if (op.reconnect && ins.length === 1 && outs.length === 1) proc.flows.push({ id: `f_${ins[0].from}_${outs[0].to}`, from: ins[0].from, to: outs[0].to, label: ins[0].label });
      proc.nodes = proc.nodes.filter((x) => x.id !== n.id);
      for (const a of m.sapAgents) a.nodeIds = a.nodeIds.filter((x) => x !== n.id);
      for (const g of m.gaps) g.nodeIds = g.nodeIds.filter((x) => x !== n.id);
      proc.changelog.push({ at: now, by: ctx.actor, summary: `Schritt ${n.id} „${n.name}“ entfernt` });
      return { message: `Schritt ${n.id} entfernt` };
    }

    case 'process.addFlow': {
      const proc = getProcess(m, op.processId);
      getNode(proc, op.flow.from);
      getNode(proc, op.flow.to);
      const id = op.flow.id?.trim() || `f_${op.flow.from}_${op.flow.to}`;
      if (proc.flows.some((f) => f.id === id)) fail(`Fluss ${id} existiert bereits`);
      proc.flows.push({ id, from: op.flow.from, to: op.flow.to, label: op.flow.label ? str(op.flow.label, 'Beschriftung', 80) : undefined, isDefault: op.flow.isDefault || undefined });
      proc.changelog.push({ at: now, by: ctx.actor, summary: `Fluss ${op.flow.from} → ${op.flow.to}` });
      return { message: `Fluss ${id} ergänzt`, createdId: id };
    }

    case 'process.updateFlow': {
      const proc = getProcess(m, op.processId);
      const f = proc.flows.find((x) => x.id === op.flowId) ?? fail(`Fluss ${op.flowId} nicht gefunden`);
      if (op.patch.from !== undefined) f.from = getNode(proc, op.patch.from).id;
      if (op.patch.to !== undefined) f.to = getNode(proc, op.patch.to).id;
      if (op.patch.label !== undefined) f.label = str(op.patch.label, 'Beschriftung', 80, false) || undefined;
      if (op.patch.isDefault !== undefined) f.isDefault = op.patch.isDefault || undefined;
      return { message: `Fluss ${f.id} geändert` };
    }

    case 'process.removeFlow': {
      const proc = getProcess(m, op.processId);
      if (!proc.flows.some((f) => f.id === op.flowId)) fail(`Fluss ${op.flowId} nicht gefunden`);
      proc.flows = proc.flows.filter((f) => f.id !== op.flowId);
      return { message: `Fluss ${op.flowId} entfernt` };
    }

    case 'process.addLane': {
      const proc = getProcess(m, op.processId);
      const id = str(op.lane.id, 'Lane-ID', 40);
      if (proc.lanes.some((l) => l.id === id)) fail(`Lane ${id} existiert bereits`);
      proc.lanes.push({ id, name: str(op.lane.name, 'Name', 120), role: str(op.lane.role, 'Rolle', 120, false), systemIds: strList(op.lane.systemIds, 'Systeme') });
      return { message: `Lane ${id} ergänzt` };
    }

    case 'meta.update': {
      if (op.patch.currentPhase !== undefined) {
        if (!m.meta.phases.some((x) => x.id === op.patch.currentPhase)) fail('Unbekannte Phase');
        m.meta.currentPhase = op.patch.currentPhase;
      }
      if (op.patch.categories !== undefined) {
        const cats = strList(op.patch.categories, 'Kategorien', 60);
        if (!cats.length) fail('Mindestens eine Kategorie');
        m.meta.categories = cats;
      }
      m.meta.updatedAt = now.slice(0, 10);
      return { message: 'Rahmendaten aktualisiert' };
    }

    case 'source.add': {
      const s = op.source;
      const id = s.id?.trim() || `SRC-TG-${randomId().toUpperCase()}`;
      if (m.sources.some((x) => x.id === id)) fail(`Quelle ${id} existiert bereits`);
      m.sources.push({ id, title: str(s.title, 'Titel', LIMITS.title), url: s.url ? str(s.url, 'URL', 600) : undefined, kind: s.kind, date: s.date, reliability: s.reliability ?? 'mittel', note: s.note });
      return { message: `Quelle ${id} ergänzt`, createdId: id };
    }

    default:
      return fail(`Unbekannte Operation ${(op as { op?: string }).op}`);
  }
}

export function applyOps(model: TgModel, ops: Op[], ctx: ApplyContext): ApplyResult {
  let m = cloneModel(model);
  const results: OpResult[] = [];
  const now = ctx.now ?? new Date().toISOString();
  ops.forEach((op, index) => {
    const denied = op && typeof op === 'object' && typeof op.op === 'string' ? checkOp(m, op, ctx.principal) : 'Ungültige Operation';
    if (denied) {
      results.push({ index, op, ok: false, message: denied, denied: true });
      return;
    }
    const draft = cloneModel(m);
    try {
      const { message, createdId } = applyOne(draft, op, ctx, now);
      m = draft;
      results.push({ index, op, ok: true, message, createdId });
    } catch (e) {
      if (!(e instanceof OpError) && !(e instanceof TypeError)) throw e;
      results.push({ index, op, ok: false, message: (e as Error).message });
    }
  });
  const applied = results.filter((r) => r.ok).length;
  return { model: m, results, applied, failed: results.length - applied };
}

/** Kurzbeschreibung einer Operation (Change-Set, Protokoll) */
export function describeOp(op: Op): string {
  switch (op.op) {
    case 'requirement.submit':
      return `Anforderung einreichen: ${op.requirement.title}`;
    case 'requirement.update':
      return `${op.requirementId} ändern (${Object.keys(op.patch ?? {}).join(', ')})`;
    case 'review.setStatus':
      return `${op.requirementId}: Status → ${REQ_STATUS[op.status]?.label ?? op.status}`;
    case 'review.assess':
      return `${op.requirementId}: Abgleich → ${FIT_RESULTS[op.assessment.fit]?.label ?? op.assessment.fit}`;
    case 'gap.add':
      return `Agentenlücke anlegen: ${op.gap.title}`;
    case 'agent.link':
      return `${op.agentId} an ${op.nodeId} verorten`;
    case 'agent.unlink':
      return `${op.agentId} von ${op.nodeId} lösen`;
    case 'agent.add':
      return `Agent aufnehmen: ${op.agent.name}`;
    case 'process.addNode':
      return `Schritt ergänzen: ${op.node.name}`;
    case 'process.updateNode':
      return `${op.nodeId} ändern (${Object.keys(op.patch ?? {}).join(', ')})`;
    case 'comment.add':
      return `Kommentar zu ${op.requirementId}`;
    default:
      return op.op;
  }
}

export { SEED_AUTHOR };
