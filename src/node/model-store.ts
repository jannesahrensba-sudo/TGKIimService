/**
 * Dateispeicher (Node): ausgeliefertes Modell (model/) plus Laufzeitdokumente in .tg-data/docs
 * (gleiche Aufteilung wie der gemeinsame Speicher im Artifact).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TgModel } from '../core/types';
import { assembleModel, changedFiles, ownerOf, type ModelFiles } from '../core/model-io';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const MODEL_DIR = process.env.TG_MODEL_DIR ? path.resolve(process.env.TG_MODEL_DIR) : path.join(REPO_ROOT, 'model');
export const DATA_DIR = process.env.TG_DATA_DIR ? path.resolve(process.env.TG_DATA_DIR) : path.join(REPO_ROOT, '.tg-data');
const DOCS_DIR = () => path.join(DATA_DIR, 'docs');

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else if (e.name.endsWith('.json')) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/** Ausgelieferte Modelldateien (model/**) */
export async function readBundledFiles(dir = MODEL_DIR): Promise<ModelFiles> {
  const files: ModelFiles = {};
  for (const rel of await walk(dir)) files[rel] = JSON.parse(await fs.readFile(path.join(dir, rel), 'utf8'));
  return files;
}

/** Dokumentschlüssel → Dateipfad (Board-Dateien behalten ihren Namen, review/portal ohne .json im Schlüssel) */
const docPath = (key: string) => {
  const o = ownerOf(key);
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_.~:@+-]/g, '_');
  if (o.kind === 'board') return path.join(DOCS_DIR(), 'board', ...key.split('/').map(safe));
  if (o.kind === 'review') return path.join(DOCS_DIR(), 'review', `${safe(o.requirementId)}.json`);
  return path.join(DOCS_DIR(), 'portal', `${safe(o.authorId)}.json`);
};

export async function readOverlayDocs(): Promise<ModelFiles> {
  const files: ModelFiles = {};
  for (const rel of await walk(path.join(DOCS_DIR(), 'board'))) files[rel] = JSON.parse(await fs.readFile(path.join(DOCS_DIR(), 'board', rel), 'utf8'));
  for (const kind of ['review', 'portal'] as const) {
    for (const rel of await walk(path.join(DOCS_DIR(), kind))) {
      const body = JSON.parse(await fs.readFile(path.join(DOCS_DIR(), kind, rel), 'utf8'));
      const key = kind === 'review' ? `review/${body.requirementId ?? rel.replace(/\.json$/, '')}` : `portal/${body.authorId ?? rel.replace(/\.json$/, '')}`;
      files[key] = body;
    }
  }
  return files;
}

export async function loadModel(): Promise<TgModel> {
  return assembleModel({ ...(await readBundledFiles()), ...(await readOverlayDocs()) });
}

/** Geänderte Dokumente schreiben (portal-Dokumente tragen ihre authorId zur Wiederherstellung des Schlüssels) */
export async function saveChanges(before: TgModel, after: TgModel): Promise<string[]> {
  const changed = changedFiles(before, after);
  for (const { key, content } of changed) {
    const file = docPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const o = ownerOf(key);
    const body = o.kind === 'portal' ? { ...(content as object), authorId: o.authorId } : content;
    await fs.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  }
  return changed.map((c) => c.key);
}
