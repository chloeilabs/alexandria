#!/usr/bin/env tsx
/**
 * End-to-end smoke test for production.
 *
 * Hits the key surfaces and verifies HTTP status + minimum response
 * size + optional content markers. Catches regressions where a
 * deploy renders but a page returns empty, the DB connection drops,
 * or a route handler returns 200 with an error body.
 *
 * Designed to be run after any deploy or as part of a verification
 * pass. Doesn't replace CI (which is typecheck + lint); complements it
 * by exercising production end-to-end.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-test.ts                              # prod
 *   pnpm tsx scripts/smoke-test.ts --base=http://localhost:3000 # local
 *   pnpm tsx scripts/smoke-test.ts --json                       # CI-friendly
 *
 * Exits 0 on all-pass, 1 on any failure. Suitable for CI use.
 */
import "../lib/env";

interface Check {
  path: string;
  minBytes: number;
  /** Optional substring that must appear in the body. */
  contains?: string;
  /** Optional max latency in ms — soft check, just logs a warning. */
  warnAboveMs?: number;
}

const CHECKS: Check[] = [
  // Core surfaces
  { path: "/", minBytes: 30_000, contains: "Alexandria" },
  { path: "/about", minBytes: 5_000, contains: "tiers" },
  { path: "/search?q=mansa", minBytes: 10_000, contains: "Mansa" },
  { path: "/random", minBytes: 0 }, // 307 redirect → expect small body
  // Browse pages
  { path: "/civilization/silk-roads", minBytes: 10_000 },
  { path: "/civilization/west-african-empires", minBytes: 10_000 },
  { path: "/era/medieval", minBytes: 10_000 },
  { path: "/era/classical", minBytes: 10_000 },
  // Tier 3 anchors (hand-curated, must always render well)
  { path: "/entity/mansa-musa", minBytes: 30_000, contains: "Cairo" },
  { path: "/entity/hannibal", minBytes: 30_000, contains: "Carthage" },
  { path: "/entity/wu-zetian", minBytes: 30_000 },
  { path: "/entity/hatshepsut", minBytes: 30_000 },
  { path: "/entity/bronze-age-collapse", minBytes: 30_000 },
  // A sample from this session's anti-bias batch
  { path: "/entity/delhi-sultanate", minBytes: 30_000 },
  { path: "/entity/timurid-empire", minBytes: 30_000 },
  { path: "/entity/razia-sultana", minBytes: 30_000 },
  // Infra surfaces
  { path: "/api/health", minBytes: 200, contains: "\"status\"" },
  { path: "/sitemap.xml", minBytes: 50_000, contains: "/entity/" },
  { path: "/robots.txt", minBytes: 50 },
];

interface Args {
  base: string;
  json: boolean;
  timeoutMs: number;
}

function parseArgs(argv: readonly string[]): Args {
  let base = "https://alexandria-chloei.vercel.app";
  let json = false;
  let timeoutMs = 20_000;
  for (const a of argv) {
    if (a.startsWith("--base=")) base = a.slice("--base=".length).replace(/\/$/, "");
    else if (a === "--json") json = true;
    else if (a.startsWith("--timeout=")) {
      const n = parseInt(a.slice("--timeout=".length), 10);
      if (Number.isFinite(n) && n > 0) timeoutMs = n;
    }
  }
  return { base, json, timeoutMs };
}

interface Result {
  path: string;
  status: number;
  bytes: number;
  ms: number;
  ok: boolean;
  reason?: string;
}

async function runOne(base: string, check: Check, timeoutMs: number): Promise<Result> {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}${check.path}`, {
      signal: ac.signal,
      // Don't auto-follow — we want to see the actual response codes
      // (e.g. /random 307s).
      redirect: "manual",
    });
    const body = await r.text();
    const ms = Date.now() - t0;
    const bytes = body.length;
    const acceptableStatus = r.status >= 200 && r.status < 400;
    let ok = acceptableStatus && bytes >= check.minBytes;
    let reason: string | undefined;
    if (!acceptableStatus) reason = `HTTP ${r.status}`;
    else if (bytes < check.minBytes) reason = `body ${bytes}b < ${check.minBytes}b min`;
    if (ok && check.contains && !body.includes(check.contains)) {
      ok = false;
      reason = `missing marker "${check.contains}"`;
    }
    return { path: check.path, status: r.status, bytes, ms, ok, reason };
  } catch (err) {
    const ms = Date.now() - t0;
    return {
      path: check.path,
      status: 0,
      bytes: 0,
      ms,
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.json) console.log(`Smoke testing ${args.base}\n`);

  const results: Result[] = [];
  // Concurrency limit of 4 — enough to be fast, not enough to look like
  // a DoS to Vercel's edge.
  const concurrency = 4;
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      const check = CHECKS[idx];
      if (idx >= CHECKS.length || !check) return;
      const r = await runOne(args.base, check, args.timeoutMs);
      results[idx] = r;
      if (!args.json) {
        const mark = r.ok ? "✓" : "✗";
        const detail = r.ok ? `${r.bytes}b  ${r.ms}ms` : `${r.reason}  (${r.ms}ms)`;
        console.log(`  ${mark} ${check.path.padEnd(48)} ${detail}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          base: args.base,
          total: results.length,
          pass,
          fail,
          results,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n${pass}/${results.length} pass  ·  ${fail} fail`);
    if (fail > 0) {
      console.log("\nFailures:");
      for (const r of results) {
        if (!r.ok) console.log(`  ${r.path}  →  ${r.reason}`);
      }
    }
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
