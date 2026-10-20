/**
 * Datenquelle und Zugang der Plattform:
 *  - "server":   eigener Plattform-Server (Zugangscodes, Claude API, Daten in .tg-data)
 *  - "artifact": in Claude geteilt – gemeinsamer Speicher (db), Identität über „user“, Agenten über „sample“
 *  - "demo":     lokal im Browser (Änderungen nur hier, Rolle frei wählbar)
 */
import type { TgModel } from '@core/types';
import { applyOps, type ApplyResult, type Op } from '@core/ops';
import type { Principal, Role } from '@core/access';
import type { AgentTurnInput, AgentTurnResult } from '@agents/runner';
import { bundledFiles, bundledModel } from './bundled';
import { createSharedStore, DEFAULT_ACCESS, type AccessConfig, type Db, type SharedStore } from './artifact-store';
import { runSampleAgent, sampleAvailability, type AgentAvailability, type AgentHooks } from './sample-agent';

export type BackendKind = 'server' | 'artifact' | 'demo';

export interface Identity {
  /** null: noch kein Name/Unternehmen angegeben */
  principal: Principal | null;
  /** Kennung der Person auch ohne Profil */
  authorId: string | null;
  role: Role;
  isOwner: boolean;
  /** darf gemeinsame Daten schreiben (null = unbekannt) */
  canWrite: boolean | null;
  boardAccess: boolean;
  /** Servermodus: für die Anmeldung nötige Zugangscodes */
  codes?: { portal: boolean; member: boolean; moderation: boolean };
}

export interface ProfileInput {
  name: string;
  company: string;
  /** Servermodus: Zugangscode; Demo: gewünschte Rolle */
  code?: string;
  role?: Role;
}

export interface Backend {
  kind: BackendKind;
  load(): Promise<TgModel>;
  subscribe?(fn: (m: TgModel) => void): () => void;
  identity(model: TgModel): Promise<Identity>;
  /** Profil setzen bzw. anmelden – liefert die neue Identität */
  signIn(input: ProfileInput, model: TgModel): Promise<Identity>;
  signOut?(): Promise<void>;
  apply(model: TgModel, ops: Op[], opts: { actor: string; principal: Principal; summary?: string }): Promise<ApplyResult>;
  agentAvailability(): Promise<AgentAvailability>;
  runAgent(req: AgentTurnInput, model: TgModel, hooks: AgentHooks): Promise<AgentTurnResult>;
  access?: { read(): Promise<AccessConfig>; write(c: AccessConfig): Promise<void>; subscribe(fn: (c: AccessConfig) => void): () => void };
  reset?(): Promise<TgModel>;
}

export type { AccessConfig, AgentAvailability, AgentHooks };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'x';

// ---------------------------------------------------------------------------- Demo (nur dieser Browser)

const LOCAL_MODEL = 'tg.model.v1';
const LOCAL_PROFILE = 'tg.profile.v1';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* Speicher nicht verfügbar – nur diese Sitzung */
  }
}

function demoBackend(): Backend {
  let profile = readJson<{ name: string; company: string; role: Role }>(LOCAL_PROFILE);
  const ident = (): Identity => {
    if (!profile) return { principal: null, authorId: null, role: 'member', isOwner: false, canWrite: true, boardAccess: true };
    const authorId = `demo-${slug(profile.company)}~${slug(profile.name)}`;
    const role = profile.role;
    return { principal: { role, authorId, name: profile.name, company: profile.company, owner: role === 'moderation' }, authorId, role, isOwner: role === 'moderation', canWrite: true, boardAccess: role !== 'portal' };
  };
  return {
    kind: 'demo',
    async load() {
      return readJson<TgModel>(LOCAL_MODEL) ?? bundledModel();
    },
    identity: async () => ident(),
    async signIn(input) {
      profile = { name: input.name.trim(), company: input.company.trim(), role: input.role ?? 'member' };
      writeJson(LOCAL_PROFILE, profile);
      return ident();
    },
    async signOut() {
      profile = null;
      writeJson(LOCAL_PROFILE, null);
    },
    async apply(model, ops, opts) {
      const res = applyOps(model, ops, { actor: opts.actor, principal: opts.principal });
      if (res.applied) writeJson(LOCAL_MODEL, res.model);
      return res;
    },
    agentAvailability: sampleAvailability,
    runAgent: runSampleAgent,
    async reset() {
      writeJson(LOCAL_MODEL, null);
      return bundledModel();
    },
  };
}

// ---------------------------------------------------------------------------- Artifact (geteilt in Claude)

interface UserCap {
  isOwner(): Promise<boolean>;
  can(name: string): Promise<boolean | null>;
  id(): Promise<string | null>;
}

async function artifactBackend(claude: { use(n: string): Promise<unknown> }): Promise<Backend> {
  const [user, db] = await Promise.all([claude.use('user').catch(() => null) as Promise<UserCap | null>, claude.use('db').catch(() => null) as Promise<Db | null>]);
  const owner = user ? await user.isOwner().catch(() => false) : false;
  const uid = user ? await user.id().catch(() => null) : null;
  let canWrite = user ? await user.can('data.write').catch(() => null) : null;
  let shared: SharedStore | null = db ? createSharedStore(db, bundledFiles) : null;
  let initial: TgModel | null = null;
  let access: AccessConfig = DEFAULT_ACCESS;
  if (shared) {
    try {
      [initial, access] = await Promise.all([shared.load(), shared.readAccess()]);
    } catch (e) {
      console.warn('Gemeinsamer Speicher nicht lesbar – Arbeit nur in diesem Browser', e);
      shared = null;
    }
  }
  if (!shared) return { ...demoBackend(), kind: 'demo' };
  const store = shared;
  const stopAccess = store.subscribeAccess((c) => (access = c));
  void stopAccess;

  const resolve = (model: TgModel): Identity => {
    const profile = uid ? model.profiles.find((p) => p.authorId === uid) : undefined;
    let role: Role;
    if (owner || (uid && access.moderators.includes(uid))) role = 'moderation';
    else if (canWrite === false || !uid) role = 'guest';
    else role = access.boardOpen || access.boardMembers.includes(uid) ? 'member' : 'portal';
    const boardAccess = role === 'moderation' || role === 'member' || (role === 'guest' && access.boardOpen);
    const principal: Principal | null = profile && uid ? { role, authorId: uid, name: profile.name, company: profile.company, owner } : null;
    return { principal, authorId: uid, role, isOwner: owner, canWrite, boardAccess };
  };

  return {
    kind: 'artifact',
    load: async () => initial ?? (await store.load()),
    subscribe: (fn) => store.subscribe(fn),
    identity: async (model) => resolve(model),
    async signIn(input, model) {
      if (!uid) throw new Error('Ohne Anmeldung bei Claude kann kein Profil gespeichert werden.');
      const draft: Principal = { role: owner ? 'moderation' : 'member', authorId: uid, name: input.name, company: input.company, owner };
      try {
        const res = await store.commit([{ op: 'profile.set', name: input.name, company: input.company }], { actor: input.name, principal: draft });
        if (!res.applied) throw new Error(res.results[0]?.message ?? 'Profil nicht gespeichert');
        return resolve(res.model);
      } catch (e) {
        if (/Schreibrechte/.test((e as Error).message)) canWrite = false;
        void model;
        throw e;
      }
    },
    apply: (_model, ops, opts) => store.commit(ops, opts),
    agentAvailability: sampleAvailability,
    runAgent: runSampleAgent,
    access: { read: () => store.readAccess(), write: (c) => store.writeAccess(c), subscribe: (fn) => store.subscribeAccess(fn) },
  };
}

// ---------------------------------------------------------------------------- Server

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function serverBackend(): Promise<Backend> {
  let version = '';
  const load = async () => {
    const r = await json<{ model: TgModel; version: string }>(await fetch('/api/model'));
    version = r.version;
    return r.model;
  };
  const session = async (): Promise<Identity> => json<Identity>(await fetch('/api/session'));
  return {
    kind: 'server',
    load,
    subscribe(fn) {
      let stopped = false;
      const tick = async () => {
        if (document.hidden) return;
        const v = await json<{ version: string }>(await fetch('/api/model/version'));
        if (version && v.version !== version) {
          const m = await load();
          if (!stopped) fn(m);
        }
      };
      const timer = setInterval(() => void tick().catch(() => undefined), 5000);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    },
    identity: () => session(),
    async signIn(input) {
      return json<Identity>(await fetch('/api/session', post(input)));
    },
    async signOut() {
      await fetch('/api/session', { method: 'DELETE' });
    },
    async apply(_model, ops, opts) {
      const r = await json<ApplyResult & { version: string }>(await fetch('/api/ops', post({ ops, summary: opts.summary })));
      version = r.version;
      return r;
    },
    async agentAvailability() {
      const s = await json<{ configured: boolean; model: string }>(await fetch('/api/agents'));
      return s.configured
        ? { ok: true, via: 'api', label: `Claude API · ${s.model}`, hint: 'Ergebnisse sind Vorschläge; übernommen wird mit Ihren Rechten.' }
        : { ok: false, via: 'none', label: 'Claude API nicht konfiguriert', hint: 'ANTHROPIC_API_KEY setzen (oder `ant auth login`) und den Server neu starten.' };
    },
    async runAgent(req, _model, hooks) {
      const { principal: _p, ...body } = req;
      return json<AgentTurnResult>(await fetch(`/api/agents/${req.agentId}`, { ...post(body), signal: hooks.signal }));
    },
  };
}

export async function connectBackend(): Promise<Backend> {
  if (!__STATIC__) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch('/api/health', { signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok && (await res.json()).mode === 'server') return await serverBackend();
    } catch {
      /* kein Server erreichbar */
    }
  }
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (claude?.use) return artifactBackend(claude as { use(n: string): Promise<unknown> });
  return demoBackend();
}
