// Hit every public site route and expect a 200. Requires `next start` or
// `next dev` to be running at SMOKE_BASE_URL (default http://localhost:3000).
//
// Usage:
//   pnpm site:smoke
//   SMOKE_BASE_URL=https://alexandria.chloei.ai pnpm site:smoke

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const ROUTES: Array<{ path: string; expectStatus?: number; method?: "GET" | "POST"; body?: unknown }> = [
  { path: "/" },
  { path: "/search" },
  { path: "/search?q=test" },
  { path: "/browse" },
  { path: "/quality" },
  { path: "/about" },
  { path: "/api/health" },
  {
    path: "/api/mcp",
    method: "POST",
    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  },
];

async function main(): Promise<void> {
  let failures = 0;
  for (const route of ROUTES) {
    const url = `${BASE}${route.path}`;
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        method: route.method ?? "GET",
        headers: route.body
          ? { "content-type": "application/json", accept: "application/json, text/event-stream" }
          : undefined,
        body: route.body ? JSON.stringify(route.body) : undefined,
      });
      const ms = Date.now() - startedAt;
      const ok = res.status === (route.expectStatus ?? 200) || res.status === 202;
      console.log(`${ok ? "✓" : "✗"} ${res.status} ${route.method ?? "GET"} ${route.path} (${ms}ms)`);
      if (!ok) failures++;
    } catch (err) {
      failures++;
      console.log(`✗ ERR ${route.method ?? "GET"} ${route.path}: ${(err as Error).message}`);
    }
  }
  if (failures) {
    console.error(`\n${failures} route(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${ROUTES.length} routes returned expected status.`);
}

main();
