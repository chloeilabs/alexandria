// Stdio MCP entry for Claude Desktop / Claude Code local config.
// Reuses the same tool definitions as the HTTP route.
//
// Run via `pnpm exec tsx bin/alexandria-mcp.ts`, or bundle with
// `pnpm mcp:build` and point Claude Desktop at `dist/alexandria-mcp.mjs`
// (single-file, node-only, no tsx dependency).

import "../lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAlexandriaTools } from "../lib/mcp/server";

async function main(): Promise<void> {
  const server = new McpServer({ name: "alexandria", version: "1.0.0" });
  registerAlexandriaTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[alexandria-mcp] fatal:", err);
  process.exit(1);
});
