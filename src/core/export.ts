/**
 * Exporte: Anforderungen als CSV (Excel, Jira, Azure DevOps) und als Übergabepaket an SAP (Markdown).
 */
import type { Requirement, TgModel } from './types';
import { AGENT_STATUS, FIT_RESULTS, PRIORITIES, REQ_STATUS, REQUIREMENT_TARGETS, REQUIREMENT_TYPES } from './types';
import { reviewOf } from './ops';
import { requirementAgentIds, requirementNodeIds } from './coverage';
import { findNode, statusLabel } from './queries';

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const storyText = (r: Requirement) => (r.story ? `Als ${r.story.role} möchte ich ${r.story.goal}, damit ${r.story.benefit}.` : '');
const acText = (r: Requirement) => (r.story?.acceptanceCriteria ?? []).map((c, i) => `AK${i + 1}: Gegeben ${c.given} – Wenn ${c.when} – Dann ${c.then}`).join('\n');

/** CSV mit Semikolon und BOM (Excel öffnet Umlaute korrekt) */
export function requirementsCsv(m: TgModel, list: Requirement[] = m.requirements): string {
  const head = ['ID', 'Unternehmen', 'Eingereicht von', 'Datum', 'Art', 'Bezug', 'Kategorie', 'Titel', 'Beschreibung', 'User Story', 'Akzeptanzkriterien', 'Priorität', 'Prozessschritte', 'SAP-Agenten', 'Status', 'Abgleich', 'Abgleich bestätigt', 'Empfehlung', 'TG-Priorität', 'Unterstützt von', 'SAP-Rückmeldung'];
  const rows = list.map((r) => {
    const rv = reviewOf(m, r.id);
    return [
      r.id,
      r.company,
      r.author,
      r.createdAt.slice(0, 10),
      REQUIREMENT_TYPES[r.type].label,
      REQUIREMENT_TARGETS[r.target].label,
      r.category,
      r.title,
      r.note,
      storyText(r),
      acText(r),
      r.priority ? PRIORITIES[r.priority].label : '',
      requirementNodeIds(m, r).map((id) => `${id} ${findNode(m, id)?.node.name ?? ''}`).join(' | '),
      requirementAgentIds(m, r).map((id) => m.sapAgents.find((a) => a.id === id)?.name ?? id).join(' | '),
      statusLabel(m, r),
      rv.assessment ? FIT_RESULTS[rv.assessment.fit].label : '',
      rv.assessment ? (rv.assessment.confirmed ? 'ja' : 'nein (Vorschlag)') : '',
      rv.assessment?.recommendation ?? '',
      rv.tgPriority ?? '',
      m.supports.filter((s) => s.requirementId === r.id).map((s) => s.company).join(', '),
      rv.sapFeedback ?? '',
    ].map(cell);
  });
  return `﻿${[head.map(cell), ...rows].map((r) => r.join(';')).join('\r\n')}\r\n`;
}

/** Übergabepaket an SAP: priorisierte bzw. übergebene Anforderungen mit Abgleich (Phase 3) */
export function sapHandoverMarkdown(m: TgModel, statuses = ['PRIORISIERT', 'AN_SAP_UEBERGEBEN']): string {
  const list = m.requirements
    .filter((r) => !r.withdrawn && statuses.includes(reviewOf(m, r.id).status))
    .sort((a, b) => (reviewOf(m, a.id).tgPriority ?? 999) - (reviewOf(m, b.id).tgPriority ?? 999));
  const lines: string[] = [`# ${m.meta.title} – Übergabe an SAP`, '', `Stand: ${new Date().toISOString().slice(0, 10)} · ${list.length} Anforderungen (${statuses.map((s) => REQ_STATUS[s as keyof typeof REQ_STATUS]?.label ?? s).join(', ')})`, ''];
  if (!list.length) lines.push('_Noch keine priorisierten Anforderungen._');
  for (const r of list) {
    const rv = reviewOf(m, r.id);
    const supporters = [r.company, ...m.supports.filter((s) => s.requirementId === r.id).map((s) => s.company)];
    lines.push(`## ${r.id} ${r.title}`, '');
    lines.push(`- **TG-Priorität:** ${rv.tgPriority ?? '–'} · **Status:** ${statusLabel(m, r)} · **Bezug:** ${REQUIREMENT_TARGETS[r.target].label}`);
    lines.push(`- **Unternehmen:** ${[...new Set(supporters)].join(', ')} (${new Set(supporters).size})`);
    if (r.story) lines.push(`- **User Story:** ${storyText(r)}`);
    if (r.note) lines.push(`- **Beschreibung:** ${r.note}`);
    if (r.story?.acceptanceCriteria.length) lines.push(...r.story.acceptanceCriteria.map((c, i) => `  - AK${i + 1}: Gegeben ${c.given}, wenn ${c.when}, dann ${c.then}`));
    lines.push(`- **Prozessschritte:** ${requirementNodeIds(m, r).map((id) => `${id} ${findNode(m, id)?.node.name ?? ''}`).join('; ') || '–'}`);
    lines.push(
      `- **SAP-Agenten:** ${
        requirementAgentIds(m, r)
          .map((id) => m.sapAgents.find((a) => a.id === id))
          .filter(Boolean)
          .map((a) => `${a!.name} (${AGENT_STATUS[a!.status].label})`)
          .join('; ') || '–'
      }`,
    );
    if (rv.assessment) {
      lines.push(`- **Abgleich:** ${FIT_RESULTS[rv.assessment.fit].label}${rv.assessment.confirmed ? '' : ' (unbestätigt)'} – ${rv.assessment.summary}`);
      if (rv.assessment.recommendation) lines.push(`- **Empfehlung der TG:** ${rv.assessment.recommendation}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
