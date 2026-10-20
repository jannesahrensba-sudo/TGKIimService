/** Ausgeliefertes Modell: vollständig, gültig, Brunata-Anforderungen aus der Agenten-Hooks-Liste, Aufteilung verlustfrei. */
import { describe, expect, it } from 'vitest';
import { assembleModel, splitModel } from '../src/core/model-io';
import { summarizeFindings, validateModel } from '../src/core/validate';
import { isActivity } from '../src/core/types';
import { bundled } from './helpers';

describe('Modell', () => {
  it('ist ohne Fehler gültig', async () => {
    const m = await bundled();
    const s = summarizeFindings(validateModel(m));
    expect(s.errors).toBe(0);
    expect(s.warnings).toBe(0);
  });

  it('enthält den E2E-Serviceprozess mit In-House- und Field-Service-Strecke', async () => {
    const m = await bundled();
    const p = m.processes.find((x) => x.id === 'E2E-SERVICE')!;
    expect(p.lanes.map((l) => l.role)).toEqual(expect.arrayContaining(['Service Agent', 'Service Planner', 'Service Dispatcher', 'Service Technician', 'Finance Expert']));
    const names = p.nodes.map((n) => n.name).join(' | ');
    for (const step of ['Retourenauftrag & In-House Service anlegen', 'Vorprüfung (Precheck)', 'Serviceangebot', 'Einsatz planen & disponieren', 'Fakturaanforderung']) expect(names).toContain(step);
    // Jede Aktivität ist einem Bereich und einer Quelle bzw. einem Marker zugeordnet
    for (const n of p.nodes.filter((x) => isActivity(x.type))) {
      expect(m.meta.areas.some((a) => a.id === n.areaId)).toBe(true);
      expect(n.sourceIds.length > 0 || n.marker !== 'SAP_STANDARD').toBe(true);
    }
  });

  it('kennt die Agenten aus Kick-off, V128 und öffentlichen Quellen', async () => {
    const m = await bundled();
    const byName = (n: string) => m.sapAgents.find((a) => a.name === n);
    expect(byName('In-House Service Processing Agent')?.status).toBe('GEPLANT');
    expect(byName('Service Quotation Optimization Agent')?.availability).toContain('Q1/2027');
    expect(byName('Case Classification Agent')?.status).toBe('VERFUEGBAR');
    expect(byName('Technician Briefing Agent')?.earlierNames[0]?.name).toContain('Technical Briefing Agent');
    // Kein Agent verweist auf eine unbekannte Quelle
    const sources = new Set(m.sources.map((s) => s.id));
    for (const a of m.sapAgents) for (const s of a.sourceIds) expect(sources.has(s)).toBe(true);
  });

  it('übernimmt die Agenten-Hooks von Brunata Metrona wörtlich, mit unbestätigtem Erstabgleich', async () => {
    const m = await bundled();
    const bm = m.requirements.filter((r) => r.company === 'Brunata Metrona');
    expect(bm).toHaveLength(13);
    expect(bm.map((r) => r.title)).toContain('Auftragsdisposition – Zuteilungsvorschlag');
    expect(bm.find((r) => r.id === 'ANF-013')?.note).toContain('Vermutlich nicht relevant für den Service');
    for (const r of bm) {
      const rv = m.reviews.find((x) => x.requirementId === r.id)!;
      expect(rv.status).toBe('EINGEREICHT');
      expect(rv.assessment?.confirmed).toBe(false);
      expect(rv.assessment?.marker).toBe('ABGELEITET');
    }
  });

  it('teilt sich verlustfrei in Dateien und Dokumente auf', async () => {
    const m = await bundled();
    const again = assembleModel(splitModel(m));
    expect(again).toEqual(m);
  });
});
