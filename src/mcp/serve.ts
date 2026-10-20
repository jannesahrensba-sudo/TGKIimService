/**
 * Startet einen MCP-Server über stdio (Standard für Claude Code / Claude Desktop) oder
 * Streamable HTTP (`--http [port]`, zustandslos) für entfernte Agenten.
 */
import express from 'express';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export async function serve(create: () => McpServer, name: string, defaultPort: number) {
  const httpIdx = process.argv.indexOf('--http');
  if (httpIdx < 0) {
    const server = create();
    await server.connect(new StdioServerTransport());
    // stdout gehört dem Protokoll – Logs nur auf stderr
    console.error(`[${name}] MCP-Server bereit (stdio)`);
    return;
  }
  const port = Number(process.argv[httpIdx + 1]) || defaultPort;
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.post('/mcp', async (req, res) => {
    const server = create();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error(`[${name}]`, e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Interner Fehler' }, id: null });
    }
  });
  const notAllowed = (_req: express.Request, res: express.Response) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Methode nicht erlaubt (zustandsloser Server)' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
  app.listen(port, '127.0.0.1', () => console.error(`[${name}] MCP-Server bereit: http://127.0.0.1:${port}/mcp`));
}

export { isMain } from '../node/is-main';
