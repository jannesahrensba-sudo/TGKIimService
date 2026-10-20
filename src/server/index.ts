/**
 * Plattform-Server der TG „KI im Service“: liefert die Oberfläche aus, verwaltet Zugänge (Codes),
 * wendet Operationen mit Rechteprüfung an, speichert in .tg-data und betreibt die Agenten über die Claude API.
 *
 *   npm run dev     # Server (5175) + Vite (5173)
 *   npm start       # gebaute Oberfläche aus dist/ auf Port 5175
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { TgModel } from '../core/types';
import { applyOps, type Op } from '../core/ops';
import { canWriteDoc, type Principal } from '../core/access';
import { changedFiles } from '../core/model-io';
import { requirementsCsv, sapHandoverMarkdown } from '../core/export';
import { toBpmnXml } from '../core/bpmn';
import { agentStatus, describeAgentError, runAgentTurn } from '../agents/runner';
import { loadModel, REPO_ROOT, saveChanges } from '../node/model-store';
import { isMain } from '../node/is-main';
import { loadAccessConfig, readSession, recordAttempt, roleForCode, serverAuthorId, tooManyAttempts, writeSession, type AccessConfig } from './session';

const PORT = Number(process.env.PORT ?? 5175);

const versionOf = (m: TgModel) => createHash('sha1').update(JSON.stringify(m)).digest('hex').slice(0, 12);

function identity(p: Principal | null) {
  return {
    principal: p,
    authorId: p?.authorId ?? null,
    role: p?.role ?? 'guest',
    isOwner: false,
    canWrite: Boolean(p),
    boardAccess: p ? p.role !== 'portal' : false,
    codes: { portal: true, member: true, moderation: true },
  };
}

export async function createApp(cfg?: AccessConfig) {
  const access = cfg ?? (await loadAccessConfig());
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  // Änderungen nacheinander (auch gegenüber gleichzeitigen Anfragen)
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  };

  app.get('/api/health', (_req, res) => res.json({ mode: 'server' }));

  app.get('/api/model', async (_req, res) => {
    const model = await loadModel();
    res.json({ model, version: versionOf(model) });
  });

  app.get('/api/model/version', async (_req, res) => res.json({ version: versionOf(await loadModel()) }));

  app.get('/api/session', (req, res) => res.json(identity(readSession(req, access))));

  app.post('/api/session', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (tooManyAttempts(ip)) return void res.status(429).json({ error: 'Zu viele Versuche – bitte in einigen Minuten erneut.' });
    const { name, company, code } = (req.body ?? {}) as { name?: string; company?: string; code?: string };
    const n = String(name ?? '').trim().slice(0, 120);
    const c = String(company ?? '').trim().slice(0, 160);
    if (!n || !c) return void res.status(400).json({ error: 'Bitte Namen und Unternehmen angeben.' });
    const role = roleForCode(access, String(code ?? ''));
    recordAttempt(ip, Boolean(role));
    if (!role) return void res.status(401).json({ error: 'Zugangscode unbekannt – bitte bei der Moderation der Themengruppe erfragen.' });
    const p: Principal = { role, authorId: serverAuthorId(n, c), name: n, company: c, owner: false };
    // Profil im Modell festhalten (eigenes Dokument der Person)
    await serial(async () => {
      const before = await loadModel();
      const r = applyOps(before, [{ op: 'profile.set', name: n, company: c }], { actor: n, principal: p });
      if (r.applied) await saveChanges(before, r.model);
    });
    writeSession(res, req, access, p);
    res.json(identity(p));
  });

  app.delete('/api/session', (req, res) => {
    writeSession(res, req, access, null);
    res.json({ ok: true });
  });

  app.post('/api/ops', async (req, res) => {
    const p = readSession(req, access);
    if (!p) return void res.status(401).json({ error: 'Bitte anmelden (Name, Unternehmen, Zugangscode).' });
    const ops = (req.body?.ops ?? []) as Op[];
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 200) return void res.status(400).json({ error: 'ops: 1–200 Operationen erwartet' });
    try {
      const out = await serial(async () => {
        const before = await loadModel();
        const r = applyOps(before, ops, { actor: `${p.name} (${p.company})`, principal: p });
        if (r.applied) {
          for (const { key } of changedFiles(before, r.model)) if (!canWriteDoc(key, p)) throw new Error(`Keine Berechtigung für ${key}`);
          await saveChanges(before, r.model);
        }
        return { ...r, version: versionOf(r.model) };
      });
      res.json(out);
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
    }
  });

  app.get('/api/agents', (_req, res) => res.json(agentStatus()));

  app.post('/api/agents/:id', async (req, res) => {
    const status = agentStatus();
    if (!status.configured) return void res.status(503).json({ error: 'Claude API nicht konfiguriert (ANTHROPIC_API_KEY).' });
    const p = readSession(req, access) ?? { role: 'guest' as const, authorId: null };
    const { message, history, focus } = (req.body ?? {}) as { message?: string; history?: { role: 'user' | 'assistant'; content: string }[]; focus?: Record<string, string> };
    if (!message?.trim()) return void res.status(400).json({ error: 'Nachricht fehlt' });
    try {
      const model = await loadModel();
      res.json(await runAgentTurn({ agentId: String(req.params.id), message, history: (history ?? []).slice(-12), focus, principal: p }, { model }));
    } catch (e) {
      const { status: code, message: msg } = describeAgentError(e);
      res.status(code).json({ error: msg });
    }
  });

  app.get('/api/export/anforderungen.csv', async (_req, res) => {
    res.type('text/csv; charset=utf-8').send(requirementsCsv(await loadModel()));
  });
  app.get('/api/export/uebergabe-sap.md', async (_req, res) => {
    res.type('text/markdown; charset=utf-8').send(sapHandoverMarkdown(await loadModel()));
  });
  app.get('/api/export/:process.bpmn', async (req, res) => {
    const m = await loadModel();
    const p = m.processes.find((x) => x.id === req.params.process);
    if (!p) return void res.status(404).json({ error: 'Prozess nicht gefunden' });
    res.type('application/xml').send(toBpmnXml(p, m));
  });

  const dist = path.join(REPO_ROOT, 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return { app, access };
}

if (isMain(import.meta.url)) {
  const { app, access } = await createApp();
  app.listen(PORT, () => {
    console.log(`TG KI im Service – Plattform-Server auf http://localhost:${PORT}`);
    console.log(`Zugangscodes (${access.source === 'env' ? 'aus Umgebungsvariablen' : '.tg-data/codes.json'}):`);
    console.log(`  Portal (Unternehmen):  ${access.codes.portal}`);
    console.log(`  TG-Mitglied (Board):   ${access.codes.member}`);
    console.log(`  Moderation:            ${access.codes.moderation}`);
    const s = agentStatus();
    console.log(s.configured ? `Agenten: Claude API (${s.model})` : 'Agenten: ANTHROPIC_API_KEY nicht gesetzt – Agenten deaktiviert');
  });
}
