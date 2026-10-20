/** Agentenabdeckung, Schnellabgleich und BPMN-Export. */
import { describe, expect, it } from 'vitest';
import { BpmnModdle } from 'bpmn-moddle';
import { coverageSummary, nodeCoverage, processCoverage } from '../src/core/coverage';
import { conceptsOf, quickMatch } from '../src/core/match';
import { toBpmnXml } from '../src/core/bpmn';
import { coverageReport } from '../src/core/queries';
import { requirementsCsv, sapHandoverMarkdown } from '../src/core/export';
import { bundled } from './helpers';

describe('Agentenabdeckung', () => {
  it('klassifiziert Schritte nach dem besten Agentenstatus und erkennt Lücken', async () => {
    const m = await bundled();
    const cov = processCoverage(m, 'E2E-SERVICE');
    expect(cov.get('E04')?.coverage).toBe('VERFUEGBAR'); // Case Classification Agent
    expect(cov.get('E18')?.coverage).toBe('GEPLANT'); // Service Quotation Optimization Agent (Q1/2027)
    expect(cov.get('F02')?.coverage).toBe('OHNE');
    expect(cov.get('E15')?.gaps.map((g) => g.id)).toContain('GAP-01');
    const sum = coverageSummary(m, 'E2E-SERVICE');
    expect(sum.activities).toBe(30);
    expect(sum.byClass.VERFUEGBAR + sum.byClass.GEPLANT + sum.byClass.LUECKE + sum.byClass.OHNE).toBe(30);
    expect(sum.agentsUnmapped.map((a) => a.id)).toContain('AG_RULES');
  });

  it('ein Schritt ohne Agent mit offenem Bedarf ist eine Lücke', async () => {
    const m = await bundled();
    m.sapAgents = m.sapAgents.filter((a) => !a.nodeIds.includes('F01'));
    const node = m.processes[0].nodes.find((n) => n.id === 'F01')!;
    expect(nodeCoverage(m, 'E2E-SERVICE', node).coverage).toBe('LUECKE');
  });

  it('Bericht listet Schritte ohne Agent', async () => {
    const r = coverageReport(await bundled())!;
    expect(r.stepsWithoutAgent.map((s) => s.id)).toEqual(['F02']);
  });
});

describe('Schnellabgleich', () => {
  it('erkennt Fachbegriffe auch in Komposita', () => {
    expect([...conceptsOf('Intelligente Materialverfügbarkeitsprüfung')]).toEqual(expect.arrayContaining(['material']));
    expect(conceptsOf('Materialverfügbarkeitsberechnung').has('billing')).toBe(false);
    expect(conceptsOf('Analyse des Auftragsbestands').has('material')).toBe(false);
  });

  it('schlägt für Brunata-Hooks plausible Schritte und Agenten vor', async () => {
    const m = await bundled();
    const req = (id: string) => m.requirements.find((r) => r.id === id)!;
    const disp = quickMatch(m, req('ANF-001')).proposal;
    expect(disp.nodeIds).toContain('F03');
    expect(disp.sapAgentIds).toContain('AG_FSM_DISPATCHER');
    expect(quickMatch(m, req('ANF-007')).proposal.fit).toBe('GAP');
    expect(quickMatch(m, req('ANF-011')).proposal.sapAgentIds).toContain('AG_CASE_PREP');
    expect(quickMatch(m, req('ANF-013')).proposal.fit).toBe('OFFEN');
    expect(disp.marker).toBe('ABGELEITET');
  });
});

describe('Exporte', () => {
  it('BPMN 2.0 ist mit bpmn-moddle ohne Warnungen lesbar – mit und ohne Kunden-Pool', async () => {
    const m = await bundled();
    for (const includeCustomer of [true, false]) {
      const xml = toBpmnXml(m.processes[0], m, { includeCustomer });
      const { warnings } = await new BpmnModdle().fromXML(xml);
      expect(warnings).toEqual([]);
      expect(xml).toContain('In-House Service Processing Agent');
    }
  });

  it('CSV mit BOM und Übergabepaket an SAP', async () => {
    const m = await bundled();
    const csv = requirementsCsv(m);
    expect(csv.startsWith('\ufeffID;Unternehmen')).toBe(true);
    expect(csv.split('\r\n').length).toBe(m.requirements.length + 2);
    expect(sapHandoverMarkdown(m)).toContain('Noch keine priorisierten Anforderungen');
  });
});
