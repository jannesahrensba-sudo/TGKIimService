/** MCP-Server über In-Memory-Transport gegen eine temporäre Datenablage. */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tg-mcp-'));
process.env.TG_DATA_DIR = tmp;
const { createServer } = await import('../src/mcp/tg-server');
const text = (r: unknown) => (r as { content: { text: string }[] }).content[0]?.text ?? '';
let client: Client;

beforeAll(async () => {
  const [c, s] = InMemoryTransport.createLinkedPair();
  await createServer().connect(s);
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(c);
});
afterAll(async () => {
  await client.close();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('MCP-Server tg-ki-im-service', () => {
  it('bietet Lese- und Vorschlagswerkzeuge', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['get_overview', 'get_step', 'get_sap_agent', 'list_requirements', 'quick_match', 'assess_requirement', 'apply_operations', 'validate_model']));
    expect(names).not.toContain('propose_draft');
  });

  it('liest Schritte und Agenten', async () => {
    const step = JSON.parse(text(await client.callTool({ name: 'get_step', arguments: { nodeId: 'E12' } })));
    expect(step.sapAgents.map((a: { id: string }) => a.id)).toContain('AG_IHS_PROC');
    expect(text(await client.callTool({ name: 'get_sap_agent', arguments: { agentId: 'AG_QUOTE_OPT' } }))).toContain('Q1/2027');
  });

  it('speichert einen Abgleich als unbestätigten Vorschlag', async () => {
    const r = await client.callTool({ name: 'assess_requirement', arguments: { requirementId: 'ANF-004', fit: 'STANDARD', summary: 'FSM-Routenoptimierung', rationale: 'Standard', nodeIds: ['F03'], sapAgentIds: [], standardReference: 'FSM', recommendation: 'prüfen', verify: [] } });
    expect(text(r)).toContain('"applied":1');
    const req = JSON.parse(text(await client.callTool({ name: 'get_requirement', arguments: { requirementId: 'ANF-004' } })));
    expect(req.review.assessment).toMatchObject({ fit: 'STANDARD', confirmed: false });
  });

  it('liefert die Validierung als Ressource', async () => {
    const r = await client.readResource({ uri: 'tg://recherche/standard-validierung' });
    expect((r.contents[0] as { text: string }).text).toContain('In-House Service');
  });
});
