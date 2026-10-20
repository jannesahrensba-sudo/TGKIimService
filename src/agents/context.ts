/**
 * Kontext für die Agenten: kompakte Fassung des Modells (Prozess, Agentenkatalog, Lücken, Anforderungen)
 * und – falls gesetzt – der Fokus aus der Oberfläche (ausgewählter Schritt, Agent, Anforderung).
 */
import type { TgModel } from '../core/types';
import { AGENT_STATUS, FIT_RESULTS, isActivity } from '../core/types';
import { reviewOf } from '../core/ops';
import { COVERAGE, nodeCoverage } from '../core/coverage';
import { agentDetails, requirementDetails, statusLabel, stepDetails } from '../core/queries';
import type { Principal } from '../core/access';
import { ROLES } from '../core/access';
import { toolText } from './tools';

export interface AgentFocus {
  processId?: string;
  nodeId?: string;
  agentId?: string;
  requirementId?: string;
}

export function modelDigest(m: TgModel, processId?: string): string {
  const p = m.processes.find((x) => x.id === processId) ?? m.processes[0];
  const lines: string[] = [];
  lines.push(`TG-Phase: ${m.meta.phases.find((x) => x.id === m.meta.currentPhase)?.name ?? m.meta.currentPhase}`);
  if (p) {
    lines.push(`\n## Prozess ${p.id}: ${p.name}\n${p.scope}`);
    lines.push(`Lanes: ${p.lanes.map((l) => `${l.id}=${l.name} (${l.role})`).join('; ')}`);
    for (const n of p.nodes) {
      const next = p.flows.filter((f) => f.from === n.id).map((f) => (f.label ? `${f.to}[${f.label}]` : f.to)).join(',');
      if (!isActivity(n.type)) {
        lines.push(`${n.id} ${n.type} ${n.name || '(Gateway)'} → ${next}`);
        continue;
      }
      const c = nodeCoverage(m, p.id, n);
      lines.push(
        `${n.id} [${p.lanes.find((l) => l.id === n.laneId)?.name}] ${n.name} → ${next} | ${COVERAGE[c.coverage].label}: ${c.agents.map((a) => `${a.id}(${AGENT_STATUS[a.status].label})`).join(', ') || '–'}${c.gaps.length ? ` | Lücken: ${c.gaps.map((g) => g.id).join(',')}` : ''}${c.requirements.length ? ` | Anf.: ${c.requirements.map((r) => r.id).join(',')}` : ''} | ${n.marker}`,
      );
    }
  }
  lines.push('\n## SAP-Agenten (ID | Name | Bereich | Produkt | Status | Schritte)');
  for (const a of m.sapAgents) lines.push(`${a.id} | ${a.name} | ${a.areaId} | ${a.product} | ${AGENT_STATUS[a.status].label}${a.availability ? ` – ${a.availability}` : ''} | ${a.nodeIds.join(',') || '–'}`);
  lines.push('\n## Joule-Assistenten');
  for (const a of m.assistants) lines.push(`${a.id} ${a.name} (${AGENT_STATUS[a.status].label}): ${a.description}`);
  lines.push('\n## Agentenlücken');
  for (const g of m.gaps) lines.push(`${g.id} [${g.status}] ${g.title} – Schritte ${g.nodeIds.join(',')} – Vorschlag: ${g.proposedAgent}`);
  lines.push('\n## Anforderungen (ID | Unternehmen | Titel | Status | Abgleich)');
  for (const r of m.requirements.slice(-150)) {
    const a = reviewOf(m, r.id).assessment;
    lines.push(`${r.id} | ${r.company} | ${r.title} | ${statusLabel(m, r)} | ${a ? `${FIT_RESULTS[a.fit].label}${a.confirmed ? '' : ' (Vorschlag)'}` : 'offen'}`);
  }
  lines.push(`\nKategorien: ${m.meta.categories.join('; ')}`);
  return lines.join('\n');
}

export function focusDigest(m: TgModel, focus?: AgentFocus): string {
  if (!focus) return '';
  const parts: string[] = [];
  if (focus.nodeId) parts.push(`### Ausgewählter Schritt\n${toolText(stepDetails(m, focus.nodeId), 8000)}`);
  if (focus.agentId) parts.push(`### Ausgewählter SAP-Agent\n${toolText(agentDetails(m, focus.agentId), 6000)}`);
  if (focus.requirementId) parts.push(`### Ausgewählte Anforderung\n${toolText(requirementDetails(m, focus.requirementId), 8000)}`);
  return parts.length ? `\n## Fokus aus der Oberfläche\n${parts.join('\n\n')}` : '';
}

export function principalText(p: Principal | undefined): string {
  if (!p) return 'Nutzer:in: unbekannt (nur lesen)';
  return `Nutzer:in: ${p.name ?? 'ohne Namen'} (${p.company ?? 'ohne Unternehmen'}) – Rolle ${ROLES[p.role].label}`;
}
