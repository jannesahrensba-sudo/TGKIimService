/**
 * Abfragen für Agenten, MCP und Oberfläche: kompakte, lesbare Sichten auf Prozess, Agenten und Anforderungen.
 */
import type { Requirement, TgModel } from './types';
import { AGENT_STATUS, FIT_RESULTS, REQ_STATUS, isActivity } from './types';
import { reviewOf } from './ops';
import { agentsAtNode, coverageSummary, nodeCoverage, COVERAGE, requirementAgentIds, requirementNodeIds } from './coverage';
import { quickMatch, normalize } from './match';

export function findNode(m: TgModel, nodeId: string) {
  for (const p of m.processes) {
    const n = p.nodes.find((x) => x.id === nodeId);
    if (n) return { process: p, node: n };
  }
  return null;
}

const areaName = (m: TgModel, id: string) => m.meta.areas.find((a) => a.id === id)?.nameDe ?? id;
const laneName = (m: TgModel, processId: string, laneId: string) => m.processes.find((p) => p.id === processId)?.lanes.find((l) => l.id === laneId)?.name ?? laneId;

/** Status, wie ihn alle sehen (zurückgezogene Anforderungen gesondert) */
export function statusLabel(m: TgModel, r: Requirement): string {
  return r.withdrawn ? 'Zurückgezogen' : REQ_STATUS[reviewOf(m, r.id).status].label;
}

export function overview(m: TgModel) {
  const companies = [...new Set(m.requirements.map((r) => r.company))].sort();
  return {
    tg: m.meta.title,
    currentPhase: m.meta.phases.find((p) => p.id === m.meta.currentPhase)?.name,
    processes: m.processes.map((p) => ({ id: p.id, name: p.name, steps: p.nodes.filter((n) => isActivity(n.type)).length, coverage: coverageSummary(m, p.id).byClass })),
    sapAgents: { total: m.sapAgents.length, byStatus: Object.fromEntries(Object.keys(AGENT_STATUS).map((s) => [s, m.sapAgents.filter((a) => a.status === s).length])) },
    gaps: m.gaps.map((g) => `${g.id} ${g.title} [${g.status}]`),
    requirements: { total: m.requirements.length, companies, byStatus: Object.fromEntries(Object.keys(REQ_STATUS).map((s) => [s, m.requirements.filter((r) => !r.withdrawn && reviewOf(m, r.id).status === s).length])) },
  };
}

export function processOutline(m: TgModel, processId?: string) {
  const p = m.processes.find((x) => x.id === processId) ?? m.processes[0];
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    scope: p.scope,
    lanes: p.lanes.map((l) => `${l.id}: ${l.name} (${l.role})`),
    steps: p.nodes.map((n) => {
      const cov = nodeCoverage(m, p.id, n);
      return {
        id: n.id,
        type: n.type,
        name: n.name,
        lane: laneName(m, p.id, n.laneId),
        area: areaName(m, n.areaId),
        next: p.flows.filter((f) => f.from === n.id).map((f) => (f.label ? `${f.to} [${f.label}]` : f.to)),
        ...(isActivity(n.type)
          ? {
              sapAgents: cov.agents.map((a) => `${a.name} (${AGENT_STATUS[a.status].label})`),
              coverage: COVERAGE[cov.coverage].label,
              requirements: cov.requirements.map((r) => r.id),
              gaps: cov.gaps.map((g) => g.id),
            }
          : {}),
      };
    }),
  };
}

export function stepDetails(m: TgModel, nodeId: string) {
  const hit = findNode(m, nodeId);
  if (!hit) return null;
  const { process, node } = hit;
  const cov = nodeCoverage(m, process.id, node);
  return {
    process: `${process.id} ${process.name}`,
    step: { ...node, lane: laneName(m, process.id, node.laneId), area: areaName(m, node.areaId) },
    before: process.flows.filter((f) => f.to === node.id).map((f) => `${f.from} ${findNode(m, f.from)?.node.name ?? ''}${f.label ? ` [${f.label}]` : ''}`),
    after: process.flows.filter((f) => f.from === node.id).map((f) => `${f.to} ${findNode(m, f.to)?.node.name ?? ''}${f.label ? ` [${f.label}]` : ''}`),
    coverage: COVERAGE[cov.coverage].label,
    sapAgents: cov.agents.map((a) => ({ id: a.id, name: a.name, status: AGENT_STATUS[a.status].label, availability: a.availability, product: a.product, description: a.description, marker: a.marker })),
    requirements: cov.requirements.map((r) => ({ id: r.id, company: r.company, title: r.title, status: statusLabel(m, r), fit: reviewOf(m, r.id).assessment?.fit })),
    gaps: cov.gaps.map((g) => ({ id: g.id, title: g.title, proposedAgent: g.proposedAgent, status: g.status })),
    sources: node.sourceIds.map((id) => m.sources.find((s) => s.id === id)).filter(Boolean).map((s) => `${s!.title}${s!.url ? ` – ${s!.url}` : ''}`),
  };
}

export function agentDetails(m: TgModel, agentId: string) {
  const a = m.sapAgents.find((x) => x.id === agentId);
  if (!a) return null;
  const reqs = m.requirements.filter((r) => requirementAgentIds(m, r).includes(a.id));
  return {
    ...a,
    status: `${AGENT_STATUS[a.status].label} – ${AGENT_STATUS[a.status].description}`,
    area: areaName(m, a.areaId),
    assistant: m.assistants.find((x) => x.id === a.assistantId)?.name,
    steps: a.nodeIds.map((id) => `${id} ${findNode(m, id)?.node.name ?? '?'}`),
    requirements: reqs.map((r) => ({ id: r.id, company: r.company, title: r.title, status: statusLabel(m, r) })),
    sources: a.sourceIds.map((id) => m.sources.find((s) => s.id === id)?.title ?? id),
  };
}

export function requirementDetails(m: TgModel, requirementId: string) {
  const r = m.requirements.find((x) => x.id === requirementId);
  if (!r) return null;
  const review = reviewOf(m, r.id);
  return {
    ...r,
    status: statusLabel(m, r),
    review: { ...review, fit: review.assessment ? FIT_RESULTS[review.assessment.fit].label : undefined },
    steps: requirementNodeIds(m, r).map((id) => `${id} ${findNode(m, id)?.node.name ?? '?'}`),
    sapAgents: requirementAgentIds(m, r).map((id) => {
      const a = m.sapAgents.find((x) => x.id === id);
      return a ? `${a.id} ${a.name} (${AGENT_STATUS[a.status].label})` : id;
    }),
    comments: m.comments.filter((c) => c.requirementId === r.id).map((c) => `${c.at.slice(0, 10)} ${c.author} (${c.company}): ${c.text}`),
    supportedBy: m.supports.filter((s) => s.requirementId === r.id).map((s) => s.company),
    quickMatch: quickMatch(m, r).proposal,
  };
}

export interface RequirementFilter {
  company?: string;
  status?: string;
  category?: string;
  target?: string;
  text?: string;
  nodeId?: string;
  agentId?: string;
}

export function listRequirements(m: TgModel, f: RequirementFilter = {}) {
  const q = f.text ? normalize(f.text) : '';
  return m.requirements
    .filter((r) => !f.company || r.company === f.company)
    .filter((r) => !f.status || reviewOf(m, r.id).status === f.status || (f.status === 'ZURUECKGEZOGEN' && r.withdrawn))
    .filter((r) => !f.category || r.category === f.category)
    .filter((r) => !f.target || r.target === f.target)
    .filter((r) => !f.nodeId || requirementNodeIds(m, r).includes(f.nodeId))
    .filter((r) => !f.agentId || requirementAgentIds(m, r).includes(f.agentId))
    .filter((r) => !q || normalize(`${r.id} ${r.title} ${r.note} ${r.company} ${r.category}`).includes(q))
    .map((r) => {
      const rv = reviewOf(m, r.id);
      return { id: r.id, company: r.company, type: r.type, target: r.target, category: r.category, title: r.title, status: statusLabel(m, r), fit: rv.assessment ? FIT_RESULTS[rv.assessment.fit].label : '–', supporters: m.supports.filter((s) => s.requirementId === r.id).length };
    });
}

export function search(m: TgModel, query: string, limit = 20) {
  const q = normalize(query).trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  const hit = (text: string) => {
    const t = normalize(text);
    return words.filter((w) => t.includes(w)).length / words.length;
  };
  const out: { kind: string; id: string; title: string; score: number }[] = [];
  for (const p of m.processes) for (const n of p.nodes) out.push({ kind: 'Schritt', id: n.id, title: n.name, score: hit(`${n.id} ${n.name} ${n.description} ${(n.keywords ?? []).join(' ')} ${n.objects.join(' ')}`) });
  for (const a of m.sapAgents) out.push({ kind: 'SAP-Agent', id: a.id, title: a.name, score: hit(`${a.id} ${a.name} ${a.description} ${a.keywords.join(' ')} ${a.earlierNames.map((e) => e.name).join(' ')}`) });
  for (const r of m.requirements) out.push({ kind: 'Anforderung', id: r.id, title: `${r.title} (${r.company})`, score: hit(`${r.id} ${r.title} ${r.note} ${r.company} ${r.category}`) });
  for (const g of m.gaps) out.push({ kind: 'Agentenlücke', id: g.id, title: g.title, score: hit(`${g.id} ${g.title} ${g.description} ${g.proposedAgent}`) });
  for (const s of m.sources) out.push({ kind: 'Quelle', id: s.id, title: s.title, score: hit(`${s.id} ${s.title} ${s.note ?? ''}`) });
  return out
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function coverageReport(m: TgModel, processId?: string) {
  const p = m.processes.find((x) => x.id === processId) ?? m.processes[0];
  if (!p) return null;
  const sum = coverageSummary(m, p.id);
  const steps = p.nodes
    .filter((n) => isActivity(n.type))
    .map((n) => {
      const c = nodeCoverage(m, p.id, n);
      return { id: n.id, name: n.name, area: areaName(m, n.areaId), coverage: COVERAGE[c.coverage].label, agents: agentsAtNode(m, n.id).map((a) => a.name), demand: c.requirements.map((r) => r.id), openDemand: c.openDemand.map((r) => r.id), gaps: c.gaps.map((g) => g.id) };
    });
  return {
    process: `${p.id} ${p.name}`,
    summary: { ...sum, agentsUnmapped: sum.agentsUnmapped.map((a) => a.name) },
    stepsWithoutAgent: steps.filter((s) => !s.agents.length),
    gaps: m.gaps.map((g) => ({ id: g.id, title: g.title, steps: g.nodeIds, status: g.status, proposedAgent: g.proposedAgent })),
    steps,
  };
}
