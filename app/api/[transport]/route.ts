// MCP HTTP endpoint.
//
// `mcp-handler` resolves the [transport] segment to either `mcp`
// (Streamable HTTP, modern) or `sse` (legacy). basePath must match the
// directory this route lives in.

import { createMcpHandler } from "mcp-handler";

import { registerAlexandriaTools } from "@/lib/mcp/server";

export const runtime = "nodejs";

const handler = createMcpHandler(
  (server) => {
    registerAlexandriaTools(server);
  },
  {
    serverInfo: { name: "alexandria", version: "1.0.0" },
    capabilities: { tools: {} },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  },
);

export { handler as GET, handler as POST };
