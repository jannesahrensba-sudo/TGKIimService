/** Plattform-Server: Anmeldung mit Codes, Rechte je Rolle, Speicherung in .tg-data (temporär). */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tg-server-'));
process.env.TG_DATA_DIR = tmp;
process.env.TG_PORTAL_CODE = 'PORTAL-TEST';
process.env.TG_MEMBER_CODE = 'TG-TEST';
process.env.TG_MODERATION_CODE = 'MOD-TEST';
const { createApp } = await import('../src/server/index');

let base = '';
let close: () => void = () => undefined;
const json = (body: unknown, cookie?: string): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
async function login(name: string, company: string, code: string) {
  const res = await fetch(`${base}/api/session`, json({ name, company, code }));
  return { res, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0], body: await res.json() };
}

beforeAll(async () => {
  const { app } = await createApp();
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(async () => {
  close();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('Plattform-Server', () => {
  it('liefert Modell und Sitzung; ohne Anmeldung keine Änderungen', async () => {
    const m = await (await fetch(`${base}/api/model`)).json();
    expect(m.model.requirements).toHaveLength(13);
    expect((await (await fetch(`${base}/api/session`)).json()).role).toBe('guest');
    expect((await fetch(`${base}/api/ops`, json({ ops: [{ op: 'profile.set', name: 'x', company: 'y' }] }))).status).toBe(401);
  });

  it('Code bestimmt die Rolle; falscher Code wird abgewiesen', async () => {
    expect((await login('A', 'B', 'falsch')).res.status).toBe(401);
    const p = await login('Paula', 'Testo Industrial Services', 'PORTAL-TEST');
    expect(p.body).toMatchObject({ role: 'portal', boardAccess: false });
    const mod = await login('Mara', 'Brunata Metrona', 'MOD-TEST');
    expect(mod.body).toMatchObject({ role: 'moderation', boardAccess: true });
  });

  it('Portal reicht ein, Moderation bewertet, Mitglied darf nicht bewerten – gespeichert in Dokumenten', async () => {
    const p = await login('Paula', 'Testo Industrial Services', 'PORTAL-TEST');
    const sub = await (await fetch(`${base}/api/ops`, json({ ops: [{ op: 'requirement.submit', requirement: { type: 'PROZESSTHEMA', target: 'NEUER_AGENT', category: 'Auftragsdisposition', title: 'Tourenvorschlag', note: 'Tagesrouten', nodeIds: ['F03'], sapAgentIds: [] } }] }, p.cookie))).json();
    expect(sub.results[0].createdId).toBe('ANF-014');
    const member = await login('Bernd', 'Bosch Thermotechnik', 'TG-TEST');
    const denied = await (await fetch(`${base}/api/ops`, json({ ops: [{ op: 'review.setStatus', requirementId: 'ANF-014', status: 'ABGELEHNT', note: 'nein' }] }, member.cookie))).json();
    expect(denied.results[0].denied).toBe(true);
    const mod = await login('Mara', 'Brunata Metrona', 'MOD-TEST');
    const ok = await (await fetch(`${base}/api/ops`, json({ ops: [{ op: 'review.setStatus', requirementId: 'ANF-014', status: 'IN_BEWERTUNG' }] }, mod.cookie))).json();
    expect(ok.applied).toBe(1);
    const files = await fs.readdir(path.join(tmp, 'docs', 'portal'));
    expect(files.some((f) => f.startsWith('srv-testo-industrial-services'))).toBe(true);
    expect(await fs.readdir(path.join(tmp, 'docs', 'review'))).toContain('ANF-014.json');
    // Nach Neustart (neu laden) bleibt der Stand
    const m = await (await fetch(`${base}/api/model`)).json();
    expect(m.model.requirements.find((r: { id: string }) => r.id === 'ANF-014').company).toBe('Testo Industrial Services');
  });

  it('Exporte', async () => {
    expect(await (await fetch(`${base}/api/export/anforderungen.csv`)).text()).toMatch(/^\uFEFF?ID;Unternehmen/);
    expect(await (await fetch(`${base}/api/export/E2E-SERVICE.bpmn`)).text()).toContain('<bpmn:definitions');
  });
});
