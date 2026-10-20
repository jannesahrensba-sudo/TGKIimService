/**
 * Gemeinsamer Speicher im Artifact (Laufzeitfähigkeit „db“).
 *
 * Grundlage bleibt das ausgelieferte Modell. Dokumente überlagern es – getrennt nach Eigentümer:
 *  - board/<datei>        Prozess, Agentenkatalog, Lücken, Quellen, Seed-Anforderungen – Moderation (Regel: admin)
 *  - review/<ANF-ID>      Status und Abgleich einer Anforderung – Moderation (Regel: admin)
 *  - portal/<Nutzer-ID>   Profil, eigene Anforderungen, Kommentare, Unterstützung – nur die Person selbst
 *                         (Regel portal/{self}); lesen dürfen alle
 *  - config/access        Moderation & Board-Zugang – nur der Eigentümer des Artifacts
 *  - locks/model          kurze Lease: Änderungen laufen nacheinander auf dem neuesten Stand
 */
import type { TgModel } from '@core/types';
import { applyOps, type ApplyResult, type Op } from '@core/ops';
import { assembleModel, changedFiles, ownerOf, type ModelFiles } from '@core/model-io';
import { canWriteDoc, type Principal } from '@core/access';

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface QuerySnap {
  docs: DocSnap[];
}
interface DbError {
  code: string;
  message: string;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: DocSnap) => void, error?: (e: DbError) => void): () => void;
  acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean; expiresAt?: string }>;
}
interface CollectionRef {
  get(): Promise<QuerySnap>;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void;
  doc(id: string): DocRef;
}
export interface Db {
  doc(path: string): DocRef;
  collection(path: string): CollectionRef;
}

interface Stored {
  file: string;
  content: unknown;
  deleted?: boolean;
  updated: string;
  by: string;
}

export interface AccessConfig {
  /** Board für alle mit Zugriff auf das Artifact (sonst nur Moderation und freigeschaltete Mitglieder) */
  boardOpen: boolean;
  moderators: string[];
  boardMembers: string[];
}

export const DEFAULT_ACCESS: AccessConfig = { boardOpen: true, moderators: [], boardMembers: [] };

const COLLECTIONS = ['board', 'review', 'portal'] as const;
type Coll = (typeof COLLECTIONS)[number];
const LOCK = 'locks/model';
const ACCESS = 'config/access';
const MAX_DOC = 250_000;

/** Dateipfad → Dokument-ID (erlaubt: Buchstaben, Ziffern, _ - . ~ : @ +) */
const boardDocId = (file: string) => file.replace(/\//g, '~');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function locate(key: string): { coll: Coll; id: string } {
  const o = ownerOf(key);
  if (o.kind === 'review') return { coll: 'review', id: o.requirementId };
  if (o.kind === 'portal') return { coll: 'portal', id: o.authorId };
  return { coll: 'board', id: boardDocId(key) };
}

/** Gemeinsame Daten sind fremde Eingaben: nur plausible Dokumente übernehmen; Eigentum ergibt sich aus der Dokument-ID. */
function readColl(coll: Coll, snap: QuerySnap): Map<string, Stored> {
  const out = new Map<string, Stored>();
  for (const d of snap.docs) {
    const body = d.exists ? (d.data() as Stored | undefined) : undefined;
    if (!body || typeof body.file !== 'string') continue;
    if (!body.deleted && (body.content === null || typeof body.content !== 'object')) continue;
    const key = coll === 'board' ? body.file : `${coll}/${d.id}`;
    if (coll === 'board' && ownerOf(key).kind !== 'board') continue;
    out.set(key, body);
  }
  return out;
}

export function dbErrorText(e: unknown): string {
  const code = (e as DbError)?.code;
  if (code === 'invalid_argument') return 'Keine Schreibrechte für diesen Bereich. Bitte die Moderation bitten, Sie im Artifact freizugeben (für Moderation: Stufe „Bearbeiter/in“).';
  if (code === 'quota_exceeded') return 'Speicher des Artifacts ist voll – bitte die Moderation informieren.';
  if (code === 'resource_exhausted') return 'Zu viele Speicherzugriffe – bitte kurz warten und erneut versuchen.';
  if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled') return 'Gemeinsamer Speicher in dieser Ansicht nicht verfügbar.';
  return (e as Error)?.message ?? String(e);
}

export interface SharedStore {
  load(): Promise<TgModel>;
  subscribe(fn: (m: TgModel) => void): () => void;
  commit(ops: Op[], opts: { actor: string; principal: Principal; summary?: string }): Promise<ApplyResult>;
  readAccess(): Promise<AccessConfig>;
  writeAccess(c: AccessConfig): Promise<void>;
  subscribeAccess(fn: (c: AccessConfig) => void): () => void;
}

export function createSharedStore(db: Db, bundled: () => ModelFiles): SharedStore {
  const docs: Record<Coll, Map<string, Stored>> = { board: new Map(), review: new Map(), portal: new Map() };
  const holder = `tab-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  let queue: Promise<unknown> = Promise.resolve();

  const assemble = (): TgModel => {
    const files: ModelFiles = bundled();
    for (const c of COLLECTIONS)
      for (const [key, d] of docs[c]) {
        if (d.deleted) delete files[key];
        else files[key] = d.content;
      }
    return assembleModel(files);
  };

  const refresh = async () => {
    const snaps = await Promise.all(COLLECTIONS.map((c) => db.collection(c).get()));
    COLLECTIONS.forEach((c, i) => (docs[c] = readColl(c, snaps[i])));
  };

  const withLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    const ref = db.doc(LOCK);
    for (let i = 0; i < 30; i++) {
      const r = await ref.acquire({ holder, ttlMs: 15_000 });
      if (r.acquired) {
        try {
          return await fn();
        } finally {
          void ref.acquire({ holder, ttlMs: 1000 }).catch(() => undefined);
        }
      }
      const until = r.expiresAt ? Date.parse(r.expiresAt) - Date.now() : 400;
      await sleep(Math.min(1500, Math.max(150, until)) + Math.random() * 150);
    }
    throw new Error('Gerade speichert jemand anderes – bitte in einem Moment erneut versuchen.');
  };

  const parseAccess = (d: DocSnap | undefined): AccessConfig => {
    const b = d?.exists ? (d.data() as Partial<AccessConfig> | undefined) : undefined;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { boardOpen: b?.boardOpen !== false, moderators: ids(b?.moderators), boardMembers: ids(b?.boardMembers) };
  };

  async function commitNow(ops: Op[], actor: string, principal: Principal, summary?: string): Promise<ApplyResult> {
    try {
      return await withLock(async () => {
        await refresh();
        const before = assemble();
        const res = applyOps(before, ops, { actor, principal });
        if (res.applied === 0) return res;
        const now = new Date().toISOString();
        const changes = changedFiles(before, res.model);
        for (const { key } of changes) if (!canWriteDoc(key, principal)) throw new Error(`Keine Berechtigung für ${key}`);
        for (const { key, content } of changes) {
          const { coll, id } = locate(key);
          const body: Stored = content === null ? { file: key, content: null, deleted: true, updated: now, by: actor } : { file: key, content, updated: now, by: actor };
          if (JSON.stringify(body).length > MAX_DOC) throw new Error(`${key} ist für den Artifact-Speicher zu groß – bitte ältere Beiträge zusammenfassen oder den Servermodus nutzen.`);
          await db.collection(coll).doc(id).set(body as unknown as Record<string, unknown>);
          docs[coll].set(key, body);
        }
        void summary;
        return { ...res, model: assemble() };
      });
    } catch (e) {
      throw new Error(dbErrorText(e));
    }
  }

  return {
    async load() {
      await refresh();
      return assemble();
    },
    subscribe(fn) {
      let queued = false;
      const emit = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          try {
            fn(assemble());
          } catch (e) {
            console.error('Modell aus dem gemeinsamen Speicher nicht lesbar', e);
          }
        });
      };
      const onError = (e: DbError) => console.warn('Live-Abgleich beendet:', e.code, e.message);
      const stops = COLLECTIONS.map((c) =>
        db.collection(c).onSnapshot((s) => {
          docs[c] = readColl(c, s);
          emit();
        }, onError),
      );
      return () => stops.forEach((s) => s());
    },
    commit(ops, { actor, principal, summary }) {
      const run = queue.then(() => commitNow(ops, actor, principal, summary));
      queue = run.catch(() => undefined);
      return run;
    },
    async readAccess() {
      return parseAccess(await db.doc(ACCESS).get().catch(() => undefined));
    },
    async writeAccess(c) {
      try {
        await db.doc(ACCESS).set({ boardOpen: c.boardOpen, moderators: [...new Set(c.moderators)], boardMembers: [...new Set(c.boardMembers)] });
      } catch (e) {
        throw new Error(dbErrorText(e));
      }
    },
    subscribeAccess(fn) {
      return db.doc(ACCESS).onSnapshot((d) => fn(parseAccess(d)), (e) => console.warn('Zugänge: Live-Abgleich beendet', e.code));
    },
  };
}
