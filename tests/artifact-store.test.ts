/**
 * Gemeinsamer Speicher im Artifact gegen eine In-Memory-Nachbildung der db-Fähigkeit – inklusive der
 * Zugriffsregeln, die beim Veröffentlichen gesetzt werden (portal/{self}, board/review: admin, config: owner).
 */
import { describe, expect, it } from 'vitest';
import { createSharedStore, type Db } from '../web/src/data/artifact-store';
import { readBundledFiles } from '../src/node/model-store';
import type { Principal } from '../src/core/access';
import type { RequirementDraft } from '../src/core/ops';

type Level = 'view' | 'interact' | 'admin' | 'owner';
const RANK: Record<Level, number> = { view: 0, interact: 1, admin: 2, owner: 3 };

function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>();
  const leases = new Map<string, { holder: string; until: number }>();
  const listeners = new Set<() => void>();
  const notify = () => queueMicrotask(() => listeners.forEach((l) => l()));
  const minWrite = (path: string, uid: string): Level => {
    const [coll, id] = path.split('/');
    if (coll === 'portal') return id === uid ? 'interact' : 'owner';
    if (coll === 'board' || coll === 'review') return 'admin';
    if (coll === 'config') return 'owner';
    return 'interact';
  };
  const view = (uid: string, level: Level): Db => {
    const snap = (path: string) => ({ id: path.split('/').pop()!, exists: docs.has(path), data: () => docs.get(path) });
    const doc = (path: string) => ({
      get: async () => snap(path),
      async set(data: Record<string, unknown>) {
        if (RANK[level] < RANK[minWrite(path, uid)]) throw { code: 'invalid_argument', message: 'denied' };
        docs.set(path, structuredClone(data));
        notify();
      },
      async delete() {
        docs.delete(path);
        notify();
      },
      onSnapshot(next: (s: ReturnType<typeof snap>) => void) {
        const l = () => next(snap(path));
        listeners.add(l);
        l();
        return () => listeners.delete(l);
      },
      async acquire({ holder, ttlMs = 30000 }: { holder: string; ttlMs?: number }) {
        const cur = leases.get(path);
        if (cur && cur.until > Date.now() && cur.holder !== holder) return { acquired: false, expiresAt: new Date(cur.until).toISOString() };
        leases.set(path, { holder, until: Date.now() + ttlMs });
        return { acquired: true };
      },
    });
    const collection = (path: string) => {
      const query = () => ({ docs: [...docs.keys()].filter((k) => k.startsWith(`${path}/`) && k.split('/').length === 2).map(snap) });
      return {
        get: async () => query(),
        onSnapshot(next: (s: ReturnType<typeof query>) => void) {
          const l = () => next(query());
          listeners.add(l);
          l();
          return () => listeners.delete(l);
        },
        doc: (id: string) => doc(`${path}/${id}`),
      };
    };
    return { doc, collection } as unknown as Db;
  };
  return { docs, view };
}

const draft = (title: string): RequirementDraft => ({ type: 'PROZESSTHEMA', target: 'NEUER_AGENT', category: 'Auftragsdisposition', title, note: 'Anmerkung', nodeIds: ['F03'], sapAgentIds: [] });
const person = (role: Principal['role'], uid: string, company: string, owner = false): Principal => ({ role, authorId: uid, name: `Person ${uid}`, company, owner });

describe('Artifact-Speicher', async () => {
  const files = await readBundledFiles();
  const bundled = () => structuredClone(files);

  it('Beiträge landen im persönlichen Dokument; gleichzeitiges Einreichen ergibt eindeutige IDs', async () => {
    const db = fakeDb();
    const a = createSharedStore(db.view('u-a', 'interact'), bundled);
    const b = createSharedStore(db.view('u-b', 'interact'), bundled);
    const pa = person('member', 'u-a', 'Testo');
    const pb = person('member', 'u-b', 'Bosch');
    const [ra, rb] = await Promise.all([a.commit([{ op: 'requirement.submit', requirement: draft('A') }], { actor: 'A', principal: pa }), b.commit([{ op: 'requirement.submit', requirement: draft('B') }], { actor: 'B', principal: pb })]);
    const ids = [ra.results[0].createdId, rb.results[0].createdId].sort();
    expect(ids).toEqual(['ANF-014', 'ANF-015']);
    expect([...db.docs.keys()].sort()).toEqual(['portal/u-a', 'portal/u-b']);
    const m = await a.load();
    expect(m.requirements.filter((r) => r.authorId === 'u-a' || r.authorId === 'u-b')).toHaveLength(2);
  });

  it('Moderation schreibt Bewertungen; ohne Bearbeiter-Recht lehnt der Speicher ab', async () => {
    const db = fakeDb();
    const mod = createSharedStore(db.view('u-m', 'admin'), bundled);
    const r = await mod.commit([{ op: 'review.setStatus', requirementId: 'ANF-001', status: 'IN_BEWERTUNG' }], { actor: 'M', principal: person('moderation', 'u-m', 'Brunata Metrona') });
    expect(r.applied).toBe(1);
    expect(db.docs.has('review/ANF-001')).toBe(true);
    // Als Moderation markiert, aber im Artifact nur Mitwirkende/r → Speicher verweigert
    const weak = createSharedStore(db.view('u-x', 'interact'), bundled);
    await expect(weak.commit([{ op: 'review.setStatus', requirementId: 'ANF-002', status: 'IN_BEWERTUNG' }], { actor: 'X', principal: person('moderation', 'u-x', 'Firma') })).rejects.toThrow(/Schreibrechte/);
  });

  it('Seite prüft Rollen: Mitglied darf keine Bewertung setzen, fremde Beiträge nicht ändern', async () => {
    const db = fakeDb();
    const a = createSharedStore(db.view('u-a', 'interact'), bundled);
    const pa = person('member', 'u-a', 'Testo');
    const r = await a.commit([{ op: 'review.setStatus', requirementId: 'ANF-001', status: 'ABGELEHNT' }], { actor: 'A', principal: pa });
    expect(r.results[0].denied).toBe(true);
    expect(db.docs.size).toBe(0);
  });

  it('Eigentum ergibt sich aus der Dokument-ID, nicht aus dem Inhalt', async () => {
    const db = fakeDb();
    db.docs.set('portal/u-b', { file: 'portal/u-b', content: { requirements: [{ id: 'ANF-050', authorId: 'u-a', author: 'Fälschung', company: 'Testo', title: 'x', note: '', type: 'PROZESSTHEMA', target: 'PROZESS', category: 'x', nodeIds: [], sapAgentIds: [], createdAt: '', updatedAt: '' }], comments: [], supports: [] }, updated: '', by: '' });
    const m = await createSharedStore(db.view('u-a', 'interact'), bundled).load();
    expect(m.requirements.find((r) => r.id === 'ANF-050')?.authorId).toBe('u-b');
  });

  it('Zugänge: nur der Eigentümer schreibt config/access', async () => {
    const db = fakeDb();
    await expect(createSharedStore(db.view('u-a', 'admin'), bundled).writeAccess({ boardOpen: false, moderators: ['u-a'], boardMembers: [] })).rejects.toThrow(/Schreibrechte/);
    const owner = createSharedStore(db.view('u-o', 'owner'), bundled);
    await owner.writeAccess({ boardOpen: false, moderators: ['u-m'], boardMembers: ['u-a'] });
    expect(await owner.readAccess()).toEqual({ boardOpen: false, moderators: ['u-m'], boardMembers: ['u-a'] });
  });
});
