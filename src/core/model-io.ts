/**
 * Modell ↔ Dateien/Dokumente.
 *
 * Ausgeliefert wird das Modell als JSON-Dateien (model/). Zur Laufzeit liegen Änderungen als Dokumente
 * daneben, getrennt nach Eigentümer – so kann der gemeinsame Speicher je Dokument prüfen, wer schreiben darf:
 *  - Board-Dateien (meta.json, processes/<id>.json, sap-agents.json, gaps.json, sources.json, requirements.json)
 *    → Moderation der Themengruppe
 *  - review/<Anforderungs-ID>  → Bewertung/Status der Moderation (überlagert reviews.json)
 *  - portal/<authorId>         → alles, was eine Person selbst einbringt: Profil, eigene Anforderungen,
 *                                Kommentare, „betrifft uns auch“
 */
import type { Comment, JouleAssistant, Meta, ProcessModel, Profile, Requirement, RequirementReview, SapAgent, AgentGap, Source, Support, TgModel } from './types';
import { SEED_AUTHOR } from './types';

export type ModelFiles = Record<string, unknown>;

export const BOARD_FILES = ['meta.json', 'sap-agents.json', 'gaps.json', 'sources.json', 'requirements.json'] as const;
export const PROCESS_DIR = 'processes';
export const REVIEW_PREFIX = 'review/';
export const PORTAL_PREFIX = 'portal/';

/** Inhalt eines persönlichen Dokuments (portal/<authorId>) */
export interface PortalDoc {
  profile?: Profile;
  requirements: Requirement[];
  comments: Comment[];
  supports: Support[];
}

export type DocOwner = { kind: 'board' } | { kind: 'review'; requirementId: string } | { kind: 'portal'; authorId: string };

/** Wem gehört eine Datei bzw. ein Dokument? */
export function ownerOf(key: string): DocOwner {
  if (key.startsWith(REVIEW_PREFIX)) return { kind: 'review', requirementId: key.slice(REVIEW_PREFIX.length) };
  if (key.startsWith(PORTAL_PREFIX)) return { kind: 'portal', authorId: key.slice(PORTAL_PREFIX.length) };
  return { kind: 'board' };
}

const num = (id: string) => Number(id.replace(/\D+/g, '')) || 0;
export const byReqId = (a: { id: string }, b: { id: string }) => num(a.id) - num(b.id) || a.id.localeCompare(b.id);

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Fremde Dokumente sind Eingaben: nur plausible Einträge übernehmen. */
function plausibleRequirement(r: unknown): r is Requirement {
  const x = r as Requirement;
  return Boolean(x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.authorId === 'string' && Array.isArray(x.nodeIds) && Array.isArray(x.sapAgentIds));
}

export function assembleModel(files: ModelFiles): TgModel {
  const meta = files['meta.json'] as Meta;
  if (!meta) throw new Error('meta.json fehlt im Modell');
  const processes = Object.keys(files)
    .filter((k) => k.startsWith(`${PROCESS_DIR}/`) && files[k])
    .sort()
    .map((k) => files[k] as ProcessModel);
  const agentsFile = (files['sap-agents.json'] ?? {}) as { assistants?: JouleAssistant[]; agents?: SapAgent[] };

  const reviews = new Map<string, RequirementReview>();
  for (const r of asArray<RequirementReview>(files['reviews.json'])) reviews.set(r.requirementId, r);
  const requirements: Requirement[] = asArray<Requirement>(files['requirements.json']).map((r) => ({ ...r, authorId: r.authorId || SEED_AUTHOR }));
  const comments: Comment[] = [];
  const supports: Support[] = [];
  const profiles: Profile[] = [];

  for (const key of Object.keys(files).sort()) {
    const body = files[key];
    if (!body) continue;
    if (key.startsWith(REVIEW_PREFIX)) {
      const r = body as RequirementReview;
      if (typeof r.requirementId === 'string' && typeof r.status === 'string') reviews.set(r.requirementId, { ...r, history: asArray(r.history) });
    } else if (key.startsWith(PORTAL_PREFIX)) {
      const authorId = key.slice(PORTAL_PREFIX.length);
      const doc = body as Partial<PortalDoc>;
      if (doc.profile && typeof doc.profile.name === 'string') profiles.push({ ...doc.profile, authorId });
      // Eigentum ergibt sich aus dem Dokument, nicht aus dem Inhalt
      for (const r of asArray<Requirement>(doc.requirements)) if (plausibleRequirement(r)) requirements.push({ ...r, authorId });
      for (const c of asArray<Comment>(doc.comments)) if (c && typeof c.text === 'string' && typeof c.requirementId === 'string') comments.push({ ...c, authorId });
      for (const s of asArray<Support>(doc.supports)) if (s && typeof s.requirementId === 'string') supports.push({ ...s, authorId });
    }
  }

  // Doppelte IDs (z. B. gleichzeitiges Einreichen ohne Sperre): erste gewinnt, weitere bekommen ein Suffix
  const seen = new Set<string>();
  for (const r of requirements.sort(byReqId)) {
    if (seen.has(r.id)) r.id = `${r.id}-${r.authorId.slice(-4)}`;
    seen.add(r.id);
  }

  return {
    meta,
    processes,
    assistants: asArray(agentsFile.assistants),
    sapAgents: asArray(agentsFile.agents),
    gaps: asArray<AgentGap>(files['gaps.json']),
    sources: asArray<Source>(files['sources.json']),
    requirements: requirements.sort(byReqId),
    reviews: [...reviews.values()].sort((a, b) => byReqId({ id: a.requirementId }, { id: b.requirementId })),
    comments: comments.sort((a, b) => a.at.localeCompare(b.at)),
    supports,
    profiles,
  };
}

/** Modell → Dateien/Dokumente (Bewertungen immer als review/<id>, Beiträge je Person als portal/<authorId>). */
export function splitModel(model: TgModel): ModelFiles {
  const files: ModelFiles = {
    'meta.json': model.meta,
    'sap-agents.json': { assistants: model.assistants, agents: model.sapAgents },
    'gaps.json': model.gaps,
    'sources.json': model.sources,
    'requirements.json': model.requirements.filter((r) => r.authorId === SEED_AUTHOR),
  };
  for (const p of model.processes) files[`${PROCESS_DIR}/${p.id}.json`] = p;
  for (const r of model.reviews) files[`${REVIEW_PREFIX}${r.requirementId}`] = r;

  const portal = new Map<string, PortalDoc>();
  const docOf = (authorId: string) => {
    let d = portal.get(authorId);
    if (!d) {
      d = { requirements: [], comments: [], supports: [] };
      portal.set(authorId, d);
    }
    return d;
  };
  for (const p of model.profiles) docOf(p.authorId).profile = p;
  for (const r of model.requirements) if (r.authorId !== SEED_AUTHOR) docOf(r.authorId).requirements.push(r);
  for (const c of model.comments) docOf(c.authorId).comments.push(c);
  for (const s of model.supports) docOf(s.authorId).supports.push(s);
  for (const [authorId, doc] of portal) files[`${PORTAL_PREFIX}${authorId}`] = doc;
  return files;
}

export const cloneModel = (m: TgModel): TgModel => structuredClone(m);

/** Welche Dateien/Dokumente unterscheiden sich? (für den Speicher: nur Geändertes schreiben) */
export function changedFiles(before: TgModel, after: TgModel): { key: string; content: unknown }[] {
  const prev = splitModel(before);
  const next = splitModel(after);
  const out: { key: string; content: unknown }[] = [];
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (JSON.stringify(prev[key]) === JSON.stringify(next[key])) continue;
    out.push({ key, content: next[key] ?? null });
  }
  return out;
}
