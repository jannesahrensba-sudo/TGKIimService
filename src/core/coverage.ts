/**
 * Agentenabdeckung je Prozessschritt: Welche SAP-Agenten sind verortet, wo besteht Bedarf der Unternehmen,
 * wo fehlen Agenten (dokumentierte Lücken oder Bedarf ohne Agent)?
 */
import type { AgentGap, AgentStatus, ProcessNode, Requirement, SapAgent, TgModel, Tone } from './types';
import { AGENT_STATUS, isActivity } from './types';
import { reviewOf } from './ops';

export type CoverageClass = 'VERFUEGBAR' | 'GEPLANT' | 'LUECKE' | 'OHNE';

export const COVERAGE: Record<CoverageClass, { label: string; tone: Tone; description: string }> = {
  VERFUEGBAR: { label: 'Agent verfügbar', tone: 'positive', description: 'Mindestens ein SAP-Agent bzw. eine KI-Funktion ist verfügbar' },
  GEPLANT: { label: 'Agent geplant', tone: 'agent', description: 'SAP-Agenten nur geplant, Lab Preview oder WIP' },
  LUECKE: { label: 'Agentenlücke', tone: 'critical', description: 'Kein SAP-Agent, aber Bedarf der Unternehmen oder dokumentierte Lücke' },
  OHNE: { label: 'Ohne Agent', tone: 'neutral', description: 'Kein SAP-Agent und (noch) kein Bedarf gemeldet' },
};

const INACTIVE_STATUS = new Set(['ABGELEHNT', 'ZURUECKGESTELLT']);
const OPEN_FITS = new Set(['GAP', 'TEIL_FIT', 'OFFEN']);

/** Aktive Anforderungen (nicht zurückgezogen, nicht abgelehnt/zurückgestellt) */
export function isActiveRequirement(m: TgModel, r: Requirement): boolean {
  return !r.withdrawn && !INACTIVE_STATUS.has(reviewOf(m, r.id).status);
}

/** Prozessbezug einer Anforderung: Angabe des Unternehmens plus Zuordnung aus dem Abgleich */
export function requirementNodeIds(m: TgModel, r: Requirement): string[] {
  return [...new Set([...r.nodeIds, ...(reviewOf(m, r.id).assessment?.nodeIds ?? [])])];
}

export function requirementAgentIds(m: TgModel, r: Requirement): string[] {
  return [...new Set([...r.sapAgentIds, ...(reviewOf(m, r.id).assessment?.sapAgentIds ?? [])])];
}

export function agentsAtNode(m: TgModel, nodeId: string): SapAgent[] {
  return m.sapAgents.filter((a) => a.nodeIds.includes(nodeId) && a.status !== 'NICHT_MEHR_GENANNT').sort((a, b) => AGENT_STATUS[b.status].rank - AGENT_STATUS[a.status].rank || a.name.localeCompare(b.name));
}

export interface NodeCoverage {
  nodeId: string;
  processId: string;
  node: ProcessNode;
  agents: SapAgent[];
  bestStatus: AgentStatus | null;
  coverage: CoverageClass;
  requirements: Requirement[];
  /** Bedarf ohne passende Lösung (Abgleich offen, Teil-Fit oder Lücke) */
  openDemand: Requirement[];
  gaps: AgentGap[];
}

export function nodeCoverage(m: TgModel, processId: string, node: ProcessNode): NodeCoverage {
  const agents = agentsAtNode(m, node.id);
  const best = agents[0]?.status ?? null;
  const requirements = m.requirements.filter((r) => isActiveRequirement(m, r) && requirementNodeIds(m, r).includes(node.id));
  const openDemand = requirements.filter((r) => {
    const a = reviewOf(m, r.id).assessment;
    return !a || OPEN_FITS.has(a.fit);
  });
  const gaps = m.gaps.filter((g) => g.nodeIds.includes(node.id) && g.status !== 'GESCHLOSSEN' && g.status !== 'VERWORFEN');
  let coverage: CoverageClass;
  if (best === 'VERFUEGBAR') coverage = 'VERFUEGBAR';
  else if (best) coverage = 'GEPLANT';
  else coverage = gaps.length || openDemand.length ? 'LUECKE' : 'OHNE';
  return { nodeId: node.id, processId, node, agents, bestStatus: best, coverage, requirements, openDemand, gaps };
}

export function processCoverage(m: TgModel, processId: string): Map<string, NodeCoverage> {
  const p = m.processes.find((x) => x.id === processId);
  const out = new Map<string, NodeCoverage>();
  if (!p) return out;
  for (const n of p.nodes) out.set(n.id, nodeCoverage(m, p.id, n));
  return out;
}

export interface CoverageSummary {
  activities: number;
  byClass: Record<CoverageClass, number>;
  withGap: number;
  withDemand: number;
  agentsMapped: number;
  agentsUnmapped: SapAgent[];
}

export function coverageSummary(m: TgModel, processId: string): CoverageSummary {
  const cov = [...processCoverage(m, processId).values()].filter((c) => isActivity(c.node.type));
  const byClass: Record<CoverageClass, number> = { VERFUEGBAR: 0, GEPLANT: 0, LUECKE: 0, OHNE: 0 };
  for (const c of cov) byClass[c.coverage]++;
  const p = m.processes.find((x) => x.id === processId);
  const ids = new Set(p?.nodes.map((n) => n.id) ?? []);
  return {
    activities: cov.length,
    byClass,
    withGap: cov.filter((c) => c.gaps.length > 0).length,
    withDemand: cov.filter((c) => c.requirements.length > 0).length,
    agentsMapped: m.sapAgents.filter((a) => a.nodeIds.some((n) => ids.has(n))).length,
    agentsUnmapped: m.sapAgents.filter((a) => !m.processes.some((pp) => pp.nodes.some((n) => a.nodeIds.includes(n.id)))),
  };
}
