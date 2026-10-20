/**
 * Zugang im Servermodus: Zugangscodes je Rolle und signierte Sitzungs-Cookies.
 *  - TG_PORTAL_CODE      Unternehmen, nur Anforderungsportal
 *  - TG_MEMBER_CODE      TG-Mitglied: Board + Portal
 *  - TG_MODERATION_CODE  Moderation (Sprecherteam)
 * Ohne Umgebungsvariablen erzeugt der Server die Codes beim ersten Start in .tg-data/codes.json.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { Principal, Role } from '../core/access';
import { DATA_DIR } from '../node/model-store';

const COOKIE = 'tg_session';
const MAX_AGE_S = 14 * 24 * 3600;

export interface AccessConfig {
  codes: Record<'portal' | 'member' | 'moderation', string>;
  source: 'env' | 'file';
  secret: Buffer;
}

function generateCode(prefix: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join('');
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function loadAccessConfig(): Promise<AccessConfig> {
  const file = path.join(DATA_DIR, 'codes.json');
  const env = { portal: process.env.TG_PORTAL_CODE?.trim(), member: process.env.TG_MEMBER_CODE?.trim(), moderation: process.env.TG_MODERATION_CODE?.trim() };
  const stored = (await readJson<{ codes: AccessConfig['codes']; secret: string }>(file)) ?? null;
  const codes = {
    portal: env.portal || stored?.codes.portal || generateCode('PORTAL'),
    member: env.member || stored?.codes.member || generateCode('TG'),
    moderation: env.moderation || stored?.codes.moderation || generateCode('MOD'),
  };
  const secret = process.env.SESSION_SECRET?.trim() || stored?.secret || randomBytes(32).toString('hex');
  if (!stored || stored.codes.portal !== codes.portal || stored.codes.member !== codes.member || stored.codes.moderation !== codes.moderation || stored.secret !== secret) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, `${JSON.stringify({ codes, secret }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  return { codes, source: env.portal || env.member || env.moderation ? 'env' : 'file', secret: Buffer.from(secret, 'utf8') };
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function roleForCode(cfg: AccessConfig, code: string): Role | null {
  const c = code.trim();
  if (safeEqual(c, cfg.codes.moderation)) return 'moderation';
  if (safeEqual(c, cfg.codes.member)) return 'member';
  if (safeEqual(c, cfg.codes.portal)) return 'portal';
  return null;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'x';

/** Kennung aus Unternehmen und Name – dieselbe Person bearbeitet ihre Beiträge auch nach erneuter Anmeldung */
export const serverAuthorId = (name: string, company: string) => `srv-${slug(company)}~${slug(name)}`;

const sign = (secret: Buffer, payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function readSession(req: Request, cfg: AccessConfig): Principal | null {
  const raw = (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(cfg.secret, payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p: Principal; exp: number };
    if (data.exp < Date.now() / 1000) return null;
    const p = data.p;
    if (!['moderation', 'member', 'portal'].includes(p.role) || typeof p.name !== 'string' || typeof p.company !== 'string') return null;
    return { role: p.role, authorId: serverAuthorId(p.name, p.company), name: p.name, company: p.company, owner: false };
  } catch {
    return null;
  }
}

export function writeSession(res: Response, req: Request, cfg: AccessConfig, p: Principal | null) {
  const secure = req.secure ? '; Secure' : '';
  if (!p) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return;
  }
  const payload = Buffer.from(JSON.stringify({ p: { role: p.role, name: p.name, company: p.company }, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S }), 'utf8').toString('base64url');
  res.setHeader('Set-Cookie', `${COOKIE}=${payload}.${sign(cfg.secret, payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`);
}

/** Einfacher Schutz gegen Durchprobieren von Zugangscodes (je IP). */
const attempts = new Map<string, { count: number; until: number }>();

export function tooManyAttempts(ip: string): boolean {
  const a = attempts.get(ip);
  return Boolean(a && a.count >= 8 && a.until > Date.now());
}

export function recordAttempt(ip: string, ok: boolean) {
  if (ok) return void attempts.delete(ip);
  const a = attempts.get(ip);
  const now = Date.now();
  if (!a || a.until < now) attempts.set(ip, { count: 1, until: now + 10 * 60_000 });
  else a.count += 1;
}
