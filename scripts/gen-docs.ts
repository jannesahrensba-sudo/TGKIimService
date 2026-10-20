/**
 * Erzeugt lesbare Dokumentation aus dem Modell (für GitHub, Workshops, Übergabe an SAP):
 *  docs/prozess/E2E-SERVICE.md + .bpmn · docs/katalog/sap-agenten.md · docs/katalog/agentenluecken.md · docs/katalog/anforderungen.md
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadModel, REPO_ROOT } from '../src/node/model-store';
import { AGENT_STATUS, FIT_RESULTS, GAP_STATUS, MARKERS, REQUIREMENT_TARGETS, REQUIREMENT_TYPES, isActivity } from '../src/core/types';
import { COVERAGE, nodeCoverage } from '../src/core/coverage';
import { reviewOf } from '../src/core/ops';
import { toBpmnXml } from '../src/core/bpmn';
import { sapHandoverMarkdown } from '../src/core/export';
import { statusLabel } from '../src/core/queries';

const m = await loadModel();
const out = (rel: string) => path.join(REPO_ROOT, 'docs', rel);
const write = async (rel: string, text: string) => {
  await fs.mkdir(path.dirname(out(rel)), { recursive: true });
  await fs.writeFile(out(rel), text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  console.log(`docs/${rel}`);
};
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const head = `> Automatisch erzeugt aus \`model/\` mit \`npm run docs\` – nicht von Hand bearbeiten.\n`;

for (const p of m.processes) {
  const lines = [`# ${p.name}`, '', head, p.description, '', `**Abgrenzung:** ${p.scope}`, '', '| ID | Schritt | Lane (Rolle) | Bereich | SAP-Agenten | Abdeckung | Lücken | Marker |', '|---|---|---|---|---|---|---|---|'];
  for (const n of p.nodes.filter((x) => isActivity(x.type))) {
    const c = nodeCoverage(m, p.id, n);
    const lane = p.lanes.find((l) => l.id === n.laneId);
    lines.push(
      `| ${n.id} | ${cell(n.name)} | ${lane?.name} (${lane?.role}) | ${m.meta.areas.find((a) => a.id === n.areaId)?.nameDe ?? n.areaId} | ${cell(c.agents.map((a) => `${a.name} (${AGENT_STATUS[a.status].label})`).join('; ') || '–')} | ${COVERAGE[c.coverage].label} | ${c.gaps.map((g) => g.id).join(', ') || '–'} | ${MARKERS[n.marker].label} |`,
    );
  }
  lines.push('', '## Schritte im Detail', '');
  for (const n of p.nodes.filter((x) => isActivity(x.type))) {
    lines.push(`### ${n.id} ${n.name}`, '', n.description);
    if (n.objects.length) lines.push(`- Objekte: ${n.objects.join(', ')}`);
    if (n.apps.length) lines.push(`- Apps/UI: ${n.apps.join(', ')}`);
    if (n.scopeItems.length) lines.push(`- Scope Items: ${n.scopeItems.join(', ')}`);
    if (n.note) lines.push(`- **Hinweis:** ${n.note}`);
    const src = n.sourceIds.map((id) => m.sources.find((s) => s.id === id)).filter(Boolean);
    if (src.length) lines.push(`- Quellen: ${src.map((s) => (s!.url ? `[${s!.title}](${s!.url})` : s!.title)).join(' · ')}`);
    lines.push('');
  }
  await write(`prozess/${p.id}.md`, lines.join('\n'));
  await write(`prozess/${p.id}.bpmn`, toBpmnXml(p, m));
}

{
  const lines = ['# SAP-Agenten und KI-Funktionen (Autonomous Service)', '', head, m.meta.confidentiality, ''];
  for (const area of m.meta.areas) {
    const list = m.sapAgents.filter((a) => a.areaId === area.id);
    if (!list.length) continue;
    lines.push(`## ${area.no} ${area.nameDe} (${area.name})`, '', '| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |', '|---|---|---|---|---|---|');
    for (const a of list) lines.push(`| ${cell(a.name)} | ${AGENT_STATUS[a.status].label}${a.availability ? ` – ${cell(a.availability)}` : ''} | ${a.product} | ${a.nodeIds.join(', ') || '–'} | ${cell(a.earlierNames.map((e) => e.name).join('; ') || '–')} | ${cell(a.description)} |`);
    lines.push('');
  }
  lines.push('## Joule-Assistenten', '', ...m.assistants.map((a) => `- **${a.name}** (${AGENT_STATUS[a.status].label}): ${a.description}`));
  await write('katalog/sap-agenten.md', lines.join('\n'));
}

{
  const lines = ['# Agentenlücken – wo im Prozess fehlen Agenten?', '', head];
  for (const g of m.gaps) {
    lines.push(`## ${g.id} ${g.title}`, '', `- **Status:** ${GAP_STATUS[g.status].label} · **Herkunft:** ${g.origin} · **Marker:** ${MARKERS[g.marker].label}`, `- **Schritte:** ${g.nodeIds.join(', ')}`, `- **Anforderungen:** ${g.requirementIds.join(', ') || '–'}`, '', g.description, '', `**Vorgeschlagener Agent:** ${g.proposedAgent}`, '');
    if (g.benefit) lines.push(`**Nutzen:** ${g.benefit}`, '');
  }
  await write('katalog/agentenluecken.md', lines.join('\n'));
}

{
  const lines = ['# Anforderungen der Unternehmen', '', head];
  for (const company of [...new Set(m.requirements.map((r) => r.company))].sort()) {
    lines.push(`## ${company}`, '', '| ID | Titel | Art | Bezug | Kategorie | Status | Abgleich |', '|---|---|---|---|---|---|---|');
    for (const r of m.requirements.filter((x) => x.company === company)) {
      const a = reviewOf(m, r.id).assessment;
      lines.push(`| ${r.id} | ${cell(r.title)} | ${REQUIREMENT_TYPES[r.type].label} | ${REQUIREMENT_TARGETS[r.target].label} | ${cell(r.category)} | ${statusLabel(m, r)} | ${a ? `${FIT_RESULTS[a.fit].label}${a.confirmed ? '' : ' (Vorschlag)'}` : '–'} |`);
    }
    lines.push('');
  }
  await write('katalog/anforderungen.md', lines.join('\n'));
  await write('katalog/uebergabe-sap.md', sapHandoverMarkdown(m));
}
