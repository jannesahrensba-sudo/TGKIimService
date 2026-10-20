/**
 * Prüfregeln für das Modell: BPMN-Struktur, Referenzen (Agenten, Anforderungen, Lücken, Quellen),
 * Markerdisziplin und Workflow der Themengruppe.
 */
import type { TgModel } from './types';
import { isActivity, isEnd, isGateway, isStart } from './types';

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  ref?: { kind: 'process' | 'node' | 'agent' | 'requirement' | 'gap' | 'source'; id: string };
}

export function validateModel(m: TgModel): Finding[] {
  const out: Finding[] = [];
  const push = (severity: Severity, rule: string, message: string, ref?: Finding['ref']) => out.push({ severity, rule, message, ref });
  const sourceIds = new Set(m.sources.map((s) => s.id));
  const allNodeIds = new Map<string, string>();

  for (const p of m.processes) {
    const ids = new Set(p.nodes.map((n) => n.id));
    const laneIds = new Set(p.lanes.map((l) => l.id));
    if (!p.nodes.some((n) => isStart(n.type))) push('error', 'V01', `${p.id}: kein Startereignis`, { kind: 'process', id: p.id });
    if (!p.nodes.some((n) => isEnd(n.type))) push('error', 'V01', `${p.id}: kein Endereignis`, { kind: 'process', id: p.id });
    for (const n of p.nodes) {
      if (allNodeIds.has(n.id)) push('error', 'V07', `Schritt-ID ${n.id} doppelt (${allNodeIds.get(n.id)} und ${p.id})`, { kind: 'node', id: n.id });
      allNodeIds.set(n.id, p.id);
      if (!laneIds.has(n.laneId)) push('error', 'V03', `${n.id}: Lane ${n.laneId} fehlt`, { kind: 'node', id: n.id });
      for (const s of n.sourceIds) if (!sourceIds.has(s)) push('warn', 'V09', `${n.id}: Quelle ${s} unbekannt`, { kind: 'node', id: n.id });
      if (isActivity(n.type) && n.marker === 'SAP_STANDARD' && !n.sourceIds.length) push('warn', 'V13', `${n.id} „${n.name}“ ist als SAP-Standard markiert, hat aber keine Quelle`, { kind: 'node', id: n.id });
      if (n.marker === 'ZU_VERIFIZIEREN' && !n.note) push('info', 'V14', `${n.id}: „zu verifizieren“ ohne Prüfauftrag (Hinweis)`, { kind: 'node', id: n.id });
    }
    for (const f of p.flows) {
      if (!ids.has(f.from) || !ids.has(f.to)) push('error', 'V02', `${p.id}: Fluss ${f.id} verweist auf unbekannten Schritt`, { kind: 'process', id: p.id });
    }
    const outs = (id: string) => p.flows.filter((f) => f.from === id);
    const ins = (id: string) => p.flows.filter((f) => f.to === id);
    for (const n of p.nodes) {
      if (!isStart(n.type) && ins(n.id).length === 0) push('warn', 'V06', `${n.id} „${n.name || n.type}“ hat keinen Eingang`, { kind: 'node', id: n.id });
      if (!isEnd(n.type) && outs(n.id).length === 0) push('warn', 'V06', `${n.id} „${n.name || n.type}“ hat keinen Ausgang`, { kind: 'node', id: n.id });
      if (isGateway(n.type) && outs(n.id).length < 2 && ins(n.id).length < 2) push('warn', 'V04', `Gateway ${n.id} verzweigt nicht und führt nicht zusammen`, { kind: 'node', id: n.id });
      if (n.type === 'exclusiveGateway' && outs(n.id).length > 1 && outs(n.id).some((f) => !f.label)) push('info', 'V15', `Gateway ${n.id}: Ausgänge ohne Beschriftung`, { kind: 'node', id: n.id });
    }
    // Erreichbarkeit vom Start
    const seen = new Set<string>();
    const stack = p.nodes.filter((n) => isStart(n.type)).map((n) => n.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const f of outs(id)) stack.push(f.to);
    }
    for (const n of p.nodes) if (!seen.has(n.id)) push('warn', 'V05', `${n.id} „${n.name || n.type}“ ist vom Start nicht erreichbar`, { kind: 'node', id: n.id });
  }

  const reqIds = new Set(m.requirements.map((r) => r.id));
  const agentIds = new Set(m.sapAgents.map((a) => a.id));
  for (const a of m.sapAgents) {
    for (const n of a.nodeIds) if (!allNodeIds.has(n)) push('error', 'V08', `${a.id}: Schritt ${n} unbekannt`, { kind: 'agent', id: a.id });
    for (const s of a.sourceIds) if (!sourceIds.has(s)) push('warn', 'V09', `${a.id}: Quelle ${s} unbekannt`, { kind: 'agent', id: a.id });
    if (!a.sourceIds.length) push('warn', 'V09', `${a.id} „${a.name}“ ohne Quelle`, { kind: 'agent', id: a.id });
    if (a.assistantId && !m.assistants.some((x) => x.id === a.assistantId)) push('warn', 'V08', `${a.id}: Assistent ${a.assistantId} unbekannt`, { kind: 'agent', id: a.id });
  }
  for (const r of m.requirements) {
    for (const n of r.nodeIds) if (!allNodeIds.has(n)) push('error', 'V10', `${r.id}: Schritt ${n} unbekannt`, { kind: 'requirement', id: r.id });
    for (const a of r.sapAgentIds) if (!agentIds.has(a)) push('error', 'V10', `${r.id}: Agent ${a} unbekannt`, { kind: 'requirement', id: r.id });
    if (r.type === 'USER_STORY' && !r.story) push('warn', 'V10', `${r.id}: User Story ohne Rolle/Ziel/Nutzen`, { kind: 'requirement', id: r.id });
    if (r.type === 'USER_STORY' && r.story && !r.story.acceptanceCriteria.length) push('info', 'V16', `${r.id}: User Story ohne Akzeptanzkriterien`, { kind: 'requirement', id: r.id });
  }
  for (const rv of m.reviews) {
    if (!reqIds.has(rv.requirementId)) push('warn', 'V11', `Bewertung zu unbekannter Anforderung ${rv.requirementId}`, { kind: 'requirement', id: rv.requirementId });
    if ((rv.status === 'PRIORISIERT' || rv.status === 'AN_SAP_UEBERGEBEN') && !rv.assessment?.confirmed) push('warn', 'V11', `${rv.requirementId}: ${rv.status === 'PRIORISIERT' ? 'priorisiert' : 'an SAP übergeben'} ohne bestätigten Abgleich`, { kind: 'requirement', id: rv.requirementId });
    for (const n of rv.assessment?.nodeIds ?? []) if (!allNodeIds.has(n)) push('error', 'V10', `${rv.requirementId}: Abgleich verweist auf unbekannten Schritt ${n}`, { kind: 'requirement', id: rv.requirementId });
    for (const a of rv.assessment?.sapAgentIds ?? []) if (!agentIds.has(a)) push('error', 'V10', `${rv.requirementId}: Abgleich verweist auf unbekannten Agenten ${a}`, { kind: 'requirement', id: rv.requirementId });
    if (rv.gapId && !m.gaps.some((g) => g.id === rv.gapId)) push('warn', 'V12', `${rv.requirementId}: Lücke ${rv.gapId} unbekannt`, { kind: 'requirement', id: rv.requirementId });
  }
  for (const g of m.gaps) {
    for (const n of g.nodeIds) if (!allNodeIds.has(n)) push('error', 'V12', `${g.id}: Schritt ${n} unbekannt`, { kind: 'gap', id: g.id });
    for (const r of g.requirementIds) if (!reqIds.has(r)) push('warn', 'V12', `${g.id}: Anforderung ${r} unbekannt`, { kind: 'gap', id: g.id });
  }
  return out;
}

export function summarizeFindings(f: Finding[]) {
  return { errors: f.filter((x) => x.severity === 'error').length, warnings: f.filter((x) => x.severity === 'warn').length, infos: f.filter((x) => x.severity === 'info').length };
}
