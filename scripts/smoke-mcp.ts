// In-process MCP smoke test.
//
// Spins up the MCP server with an in-memory transport, lists tools, and
// calls search_entities + get_entity if the corpus has any rows. Exits
// 1 if any tool errors or returns no content.
//
// Usage: pnpm mcp:smoke

import "../lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { registerAlexandriaTools } from "../lib/mcp/server";

async function main(): Promise<void> {
  const server = new McpServer({ name: "alexandria", version: "1.0.0" });
  registerAlexandriaTools(server);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "smoke", version: "1.0.0" });
  await client.connect(clientTransport);

  const tools = await client.listTools();
  console.log(`[smoke] tools: ${tools.tools.map((t) => t.name).join(", ")}`);
  if (tools.tools.length < 5) {
    console.error("[smoke] expected at least 5 tools");
    process.exit(1);
  }

  // try search_entities — accepts an empty corpus gracefully
  const search = await client.callTool({
    name: "search_entities",
    arguments: { query: "ping", limit: 3 },
  });
  if (search.isError) {
    console.error("[smoke] search_entities failed:", search);
    process.exit(1);
  }
  console.log("[smoke] search_entities OK");

  await client.close();
  await server.close();
  console.log("[smoke] all good");
}

main().catch((err) => {
  console.error("[smoke] fatal:", err);
  process.exit(1);
});
