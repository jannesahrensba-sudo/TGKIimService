/** Operationen und Rechte: Portal, Mitglieder, Moderation, Eigentum an Beiträgen. */
import { describe, expect, it } from 'vitest';
import { applyOps, reviewOf, type RequirementDraft } from '../src/core/ops';
import { changedFiles } from '../src/core/model-io';
import { canWriteDoc } from '../src/core/access';
import { bundled, ctx, guest, memberA, memberB, moderation, owner, portalA } from './helpers';

const story: RequirementDraft = {
  type: 'USER_STORY',
  target: 'SAP_AGENT',
  category: 'Auftragsrückmeldungen / Funk',
  title: 'Plausibilitätsprüfung der Rückmeldung',
  note: '',
  story: { role: 'Disponent:in', goal: 'Rückmeldungen automatisch auf Plausibilität prüfen lassen', benefit: 'Fehlfakturen vermieden werden', acceptanceCriteria: [{ given: 'eine Rückmeldung', when: 'sie eingeht', then: 'prüft der Agent Zeiten und Material' }] },
  nodeIds: ['F07'],
  sapAgentIds: ['AG_DEBRIEF'],
};

describe('Anforderungen einreichen', () => {
  it('Portal: eigene Anforderung mit fortlaufender ID, Status „Eingereicht“', async () => {
    const m = await bundled();
    const r = applyOps(m, [{ op: 'requirement.submit', requirement: story }], ctx(portalA));
    expect(r.applied).toBe(1);
    expect(r.results[0].createdId).toBe('ANF-014');
    const req = r.model.requirements.find((x) => x.id === 'ANF-014')!;
    expect(req).toMatchObject({ authorId: 'u-pa', company: 'Testo Industrial Services', author: 'Paula Portal' });
    expect(reviewOf(r.model, 'ANF-014').status).toBe('EINGEREICHT');
    // Nur das persönliche Dokument der Person ändert sich
    expect(changedFiles(m, r.model).map((c) => c.key)).toEqual(['portal/u-pa']);
  });

  it('User Story ohne Rolle/Ziel/Nutzen wird abgelehnt, unbekannte Schritte ebenso', async () => {
    const m = await bundled();
    const r = applyOps(m, [{ op: 'requirement.submit', requirement: { ...story, story: undefined } }, { op: 'requirement.submit', requirement: { ...story, nodeIds: ['X99'] } }], ctx(memberA));
    expect(r.applied).toBe(0);
    expect(r.results[1].message).toContain('X99');
  });

  it('Gäste und Personen ohne Profil dürfen nichts einreichen', async () => {
    const m = await bundled();
    expect(applyOps(m, [{ op: 'requirement.submit', requirement: story }], ctx(guest)).results[0].denied).toBe(true);
    expect(applyOps(m, [{ op: 'requirement.submit', requirement: story }], ctx({ role: 'member', authorId: 'x' })).results[0].denied).toBe(true);
  });

  it('nur die einreichende Person ändert oder zieht zurück; andere Unternehmen unterstützen', async () => {
    const m0 = await bundled();
    const m1 = applyOps(m0, [{ op: 'requirement.submit', requirement: story }], ctx(memberA)).model;
    expect(applyOps(m1, [{ op: 'requirement.update', requirementId: 'ANF-014', patch: { title: 'fremd' } }], ctx(memberB)).results[0].denied).toBe(true);
    expect(applyOps(m1, [{ op: 'requirement.update', requirementId: 'ANF-014', patch: { title: 'fremd' } }], ctx(moderation)).results[0].denied).toBe(true);
    expect(applyOps(m1, [{ op: 'requirement.update', requirementId: 'ANF-014', patch: { title: 'Eigentümer darf' } }], ctx(owner)).applied).toBe(1);
    const m2 = applyOps(m1, [{ op: 'requirement.update', requirementId: 'ANF-014', patch: { title: 'Plausibilität prüfen' } }, { op: 'requirement.withdraw', requirementId: 'ANF-014' }], ctx(memberA)).model;
    expect(m2.requirements.find((r) => r.id === 'ANF-014')).toMatchObject({ title: 'Plausibilität prüfen', withdrawn: true });
    const s = applyOps(m1, [{ op: 'support.set', requirementId: 'ANF-014', on: true }], ctx(memberB));
    expect(s.model.supports).toHaveLength(1);
    expect(changedFiles(m1, s.model).map((c) => c.key)).toEqual(['portal/u-b']);
    expect(applyOps(m1, [{ op: 'support.set', requirementId: 'ANF-014', on: true }], ctx(portalA)).results[0].denied).toBe(true);
  });

  it('Portal kommentiert nur Anforderungen des eigenen Unternehmens', async () => {
    const m = await bundled();
    expect(applyOps(m, [{ op: 'comment.add', requirementId: 'ANF-001', text: 'Haben wir auch' }], ctx(portalA)).results[0].denied).toBe(true);
    expect(applyOps(m, [{ op: 'comment.add', requirementId: 'ANF-001', text: 'Haben wir auch' }], ctx(memberA)).applied).toBe(1);
  });
});

describe('Moderation', () => {
  it('Rückfrage braucht eine Frage und erscheint im Gespräch', async () => {
    const m = await bundled();
    expect(applyOps(m, [{ op: 'review.setStatus', requirementId: 'ANF-002', status: 'RUECKFRAGE' }], ctx(moderation)).applied).toBe(0);
    const r = applyOps(m, [{ op: 'review.setStatus', requirementId: 'ANF-002', status: 'RUECKFRAGE', note: 'Was bedeutet geMO?' }], ctx(moderation));
    expect(reviewOf(r.model, 'ANF-002').status).toBe('RUECKFRAGE');
    expect(r.model.comments.at(-1)?.text).toContain('geMO');
    expect(changedFiles(m, r.model).map((c) => c.key).sort()).toEqual(['portal/u-mod', 'review/ANF-002']);
  });

  it('Abgleich vorschlagen, bestätigen, priorisieren; Lücke aus Anforderung', async () => {
    const m0 = applyOps(await bundled(), [{ op: 'requirement.submit', requirement: story }], ctx(memberA)).model;
    expect(applyOps(m0, [{ op: 'review.setStatus', requirementId: 'ANF-014', status: 'PRIORISIERT' }], ctx(moderation)).applied).toBe(0);
    const r = applyOps(
      m0,
      [
        { op: 'review.assess', requirementId: 'ANF-014', assessment: { fit: 'TEIL_FIT', summary: 'Debriefing teilweise', rationale: 'Service Debriefing Agent', nodeIds: ['F07'], sapAgentIds: ['AG_DEBRIEF'], standardReference: '49X', recommendation: 'Feedback an SAP', verify: [], assessedBy: 'Test' } },
        { op: 'review.confirm', requirementId: 'ANF-014', confirmed: true },
        { op: 'review.setStatus', requirementId: 'ANF-014', status: 'PRIORISIERT' },
        { op: 'review.update', requirementId: 'ANF-014', patch: { tgPriority: 2 } },
        { op: 'gap.add', gap: { title: 'Musteranalyse Rückmeldungen', nodeIds: ['F07'], description: 'fehlt', proposedAgent: 'Rückmelde-Analyse', benefit: '', requirementIds: ['ANF-014'] } },
      ],
      ctx(moderation),
    );
    expect(r.applied).toBe(5);
    const rv = reviewOf(r.model, 'ANF-014');
    expect(rv).toMatchObject({ status: 'PRIORISIERT', tgPriority: 2, gapId: 'GAP-08' });
    expect(rv.assessment).toMatchObject({ confirmed: true, marker: 'TG' });
  });

  it('Mitglieder ändern weder Prozess, Agenten noch Bewertungen', async () => {
    const m = await bundled();
    const r = applyOps(
      m,
      [
        { op: 'process.updateNode', processId: 'E2E-SERVICE', nodeId: 'E15', patch: { description: 'x' } },
        { op: 'agent.link', agentId: 'AG_DEBRIEF', nodeId: 'E15' },
        { op: 'review.setStatus', requirementId: 'ANF-001', status: 'ABGELEHNT' },
        { op: 'gap.remove', gapId: 'GAP-01' },
      ],
      ctx(memberA),
    );
    expect(r.results.every((x) => x.denied)).toBe(true);
  });

  it('Schritt entfernen löst Verortungen und Lücken', async () => {
    const m = await bundled();
    const r = applyOps(m, [{ op: 'process.removeNode', processId: 'E2E-SERVICE', nodeId: 'E15', reconnect: true }], ctx(moderation));
    expect(r.applied).toBe(1);
    expect(r.model.sapAgents.some((a) => a.nodeIds.includes('E15'))).toBe(false);
    expect(r.model.gaps.find((g) => g.id === 'GAP-01')?.nodeIds).toEqual(['E16']);
  });
});

describe('Dokumentrechte', () => {
  it('persönliche Dokumente nur für die Person, Board und Bewertungen nur für die Moderation', () => {
    expect(canWriteDoc('portal/u-a', memberA)).toBe(true);
    expect(canWriteDoc('portal/u-b', memberA)).toBe(false);
    expect(canWriteDoc('portal/u-b', owner)).toBe(true);
    expect(canWriteDoc('review/ANF-001', memberA)).toBe(false);
    expect(canWriteDoc('review/ANF-001', moderation)).toBe(true);
    expect(canWriteDoc('processes/E2E-SERVICE.json', moderation)).toBe(true);
    expect(canWriteDoc('meta.json', portalA)).toBe(false);
  });
});
