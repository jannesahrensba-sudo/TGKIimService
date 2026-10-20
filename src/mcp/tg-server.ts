/**
 * MCP-Server „tg-ki-im-service“: Claude Code (oder andere Agenten) lesen das Modell der Themengruppe –
 * Serviceprozess, SAP-Agenten, Lücken, Anforderungen – und schlagen Abgleiche vor.
 *
 *   npm run mcp                    # stdio
 *   npm run mcp -- --http 8788     # Streamable HTTP
 *   MCP_READ_ONLY=1 npm run mcp    # nur lesen
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { applyOps, type Op } from '../core/ops';
import { MODERATION, type Principal } from '../core/access';
import { toBpmnXml } from '../core/bpmn';
import { summarizeFindings, validateModel } from '../core/validate';
import { PLATFORM_TOOLS, toolText, type ToolContext } from '../agents/tools';
import { loadModel, REPO_ROOT, saveChanges } from '../node/model-store';
import { isMain, serve } from './serve';

const READ_ONLY = process.env.MCP_READ_ONLY === '1';
const ACTOR = process.env.MCP_ACTOR ?? 'MCP-Agent';
const VALIDATION = path.join(REPO_ROOT, 'docs', 'recherche', 'standard-validierung.md');

const INSTRUCTIONS = `Arbeitsplattform der DSAG-Themengruppe „KI im Service“ (Autonomous Service Management).
Inhalt: E2E-Serviceprozess im SAP-Standard (Case Management, In-House Service, Field Service, Rückmeldung, Faktura), Katalog der SAP-Agenten (Kick-off 07/2026 WIP, V128 10/2026 Lab Preview, öffentlich belegt), Agentenlücken, Anforderungen der Unternehmen mit Status und Abgleich.
Vorgehen: get_overview → get_process / get_step → list_sap_agents / get_sap_agent → list_requirements / get_requirement → quick_match → assess_requirement (Vorschlag) → validate_model.
Regeln: SAP-Fakten nicht erfinden; Unsicheres als „zu verifizieren“ benennen; Lab Preview/WIP sind keine Produktzusagen; Abgleiche sind Vorschläge, bestätigt wird von der Moderation.`;

const APPLY_SCHEMA = z.object({ ops: z.array(z.record(z.string(), z.unknown())), dryRun: z.boolean().optional() });

const READ_TOOLS = new Set(['get_overview', 'get_process', 'get_step', 'list_sap_agents', 'get_sap_agent', 'coverage_report', 'list_requirements', 'get_requirement', 'search', 'quick_match']);

export function createServer(): McpServer {
  const server = new McpServer({ name: 'tg-ki-im-service', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  const principal: Principal = { ...MODERATION, name: ACTOR };

  for (const t of PLATFORM_TOOLS.filter((x) => READ_TOOLS.has(x.name))) {
    server.registerTool(t.name, { title: t.name, description: t.description, inputSchema: t.schema as z.ZodObject<z.ZodRawShape>, annotations: { readOnlyHint: true, openWorldHint: false } }, async (args: unknown) => {
      try {
        const model = await loadModel();
        const ctx: ToolContext = { getModel: () => model, principal, actor: ACTOR, proposals: { ops: [], notes: [] } };
        return { content: [{ type: 'text' as const, text: toolText(await t.run(ctx, t.schema.parse(args) as never), 60000) }] };
      } catch (e) {
        return { isError: true, content: [{ type: 'text' as const, text: `Fehler: ${(e as Error).message}` }] };
      }
    });
  }

  server.registerTool('validate_model', { title: 'Prüfregeln', description: 'Prüfregeln auf dem Modell (BPMN-Struktur, Referenzen, Marker, Workflow).', inputSchema: {}, annotations: { readOnlyHint: true } }, async () => {
    const f = validateModel(await loadModel());
    return { content: [{ type: 'text' as const, text: toolText({ summary: summarizeFindings(f), findings: f.slice(0, 80) }) }] };
  });

  if (!READ_ONLY) {
    const assessSchema = PLATFORM_TOOLS.find((t) => t.name === 'propose_assessment')!.schema;
    server.registerTool(
      'assess_requirement',
      { title: 'Abgleich vorschlagen', description: 'Speichert einen Abgleich (unbestätigt, Marker ABGELEITET) zu einer Anforderung: fit, summary, rationale, nodeIds, sapAgentIds, standardReference, recommendation, verify.', inputSchema: assessSchema as z.ZodObject<z.ZodRawShape>, annotations: { readOnlyHint: false, destructiveHint: false } },
      async (args: unknown) => {
        const { requirementId, ...a } = assessSchema.parse(args) as { requirementId: string } & Record<string, unknown>;
        return runOps([{ op: 'review.assess', requirementId, assessment: { ...a, assessedBy: ACTOR, marker: 'ABGELEITET' } } as unknown as Op], principal);
      },
    );
    server.registerTool(
      'apply_operations',
      { title: 'Operationen anwenden', description: 'Wendet validierte Operationen mit Moderationsrechten an (z. B. gap.add, agent.link, review.setStatus, process.updateNode). dryRun prüft nur.', inputSchema: APPLY_SCHEMA, annotations: { readOnlyHint: false, destructiveHint: false } },
      async (args: unknown) => {
        const { ops, dryRun } = APPLY_SCHEMA.parse(args);
        return runOps(ops as unknown as Op[], principal, dryRun);
      },
    );
  }

  server.registerResource('standard-validierung', 'tg://recherche/standard-validierung', { title: 'Validierung SAP-Standard & KI-Agenten', mimeType: 'text/markdown' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await fs.readFile(VALIDATION, 'utf8') }] }));
  server.registerResource('e2e-bpmn', 'tg://prozess/E2E-SERVICE.bpmn', { title: 'E2E-Serviceprozess als BPMN 2.0', mimeType: 'application/xml' }, async (uri) => {
    const m = await loadModel();
    return { contents: [{ uri: uri.href, mimeType: 'application/xml', text: toBpmnXml(m.processes[0], m) }] };
  });
  return server;
}

async function runOps(ops: Op[], principal: Principal, dryRun = false) {
  try {
    const before = await loadModel();
    const res = applyOps(before, ops, { actor: ACTOR, principal });
    if (!dryRun && res.applied) await saveChanges(before, res.model);
    return { content: [{ type: 'text' as const, text: toolText({ applied: res.applied, failed: res.failed, dryRun, results: res.results.map((r) => `${r.ok ? 'OK' : 'FEHLER'} ${r.message}`) }) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text' as const, text: `Fehler: ${(e as Error).message}` }] };
  }
}

if (isMain(import.meta.url)) await serve(createServer, 'tg-ki-im-service', 8788);
