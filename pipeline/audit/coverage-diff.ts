#!/usr/bin/env tsx
/**
 * Daily bias-regression detector. Computes today's per-civ share of
 * total Tier ≥ 1 entities, diffs against the previous snapshot, and
 * flags any civilizational tag whose share dropped by more than
 * `FLAG_THRESHOLD_PP` percentage points.
 *
 * Storage: the previous snapshot lives in `featured_cache.meta.bias`,
 * which the daily cron route writes alongside the featured-set refresh.
 * No new table — `featured_cache` is already updated daily by
 * /api/cron/refresh-featured.
 *
 * Usage as CLI:
 *   pnpm tsx pipeline/audit/coverage-diff.ts            # human-readable
 *   pnpm tsx pipeline/audit/coverage-diff.ts --json     # machine-readable
 *
 * Usage as module (called from the cron route):
 *   const { flagged, snapshot } = await runCoverageDiff();
 */
import "../../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../../lib/db";

export const FLAG_THRESHOLD_PP = 5;

export interface CoverageSnapshot {
  generated_at: string;
  total_tier1_plus: number;
  shares: Record<string, number>; // civ-tag -> percent of total (0..100)
}

export interface CoverageDiffResult {
  snapshot: CoverageSnapshot;
  previous: CoverageSnapshot | null;
  flagged: Array<{
    civ: string;
    prev_pct: number;
    now_pct: number;
    drop_pp: number;
  }>;
}

async function readPreviousSnapshot(): Promise<CoverageSnapshot | null> {
  const rows = await db.execute<{ meta: { bias?: { snapshot?: CoverageSnapshot } } | null }>(sql`
    SELECT meta FROM featured_cache ORDER BY created_at DESC LIMIT 1
  `);
  const r = Array.from(rows)[0];
  return r?.meta?.bias?.snapshot ?? null;
}

async function computeSnapshot(): Promise<CoverageSnapshot> {
  // Per-civ count of entities at Tier ≥ 1 (the publishable layer).
  const rows = await db.execute<{ civ: string; n: number }>(sql`
    SELECT er.region_value AS civ, COUNT(DISTINCT e.qid)::int AS n
    FROM entity_regions er
    JOIN entities e ON e.qid = er.entity_qid
    WHERE er.region_kind = 'civilizational' AND e.tier >= 1
    GROUP BY er.region_value
  `);
  const arr = Array.from(rows);
  const total = arr.reduce((s, r) => s + r.n, 0);
  const shares: Record<string, number> = {};
  for (const r of arr) {
    shares[r.civ] = total === 0 ? 0 : (r.n / total) * 100;
  }
  return {
    generated_at: new Date().toISOString(),
    total_tier1_plus: total,
    shares,
  };
}

export async function runCoverageDiff(): Promise<CoverageDiffResult> {
  const snapshot = await computeSnapshot();
  const previous = await readPreviousSnapshot();

  const flagged: CoverageDiffResult["flagged"] = [];
  if (previous) {
    for (const civ of Object.keys(previous.shares)) {
      const prev = previous.shares[civ] ?? 0;
      const now = snapshot.shares[civ] ?? 0;
      const drop = prev - now;
      if (drop > FLAG_THRESHOLD_PP) {
        flagged.push({
          civ,
          prev_pct: Number(prev.toFixed(2)),
          now_pct: Number(now.toFixed(2)),
          drop_pp: Number(drop.toFixed(2)),
        });
      }
    }
  }

  return { snapshot, previous, flagged };
}

function fmtConsole(r: CoverageDiffResult): string {
  const lines: string[] = [];
  lines.push(`Coverage diff — ${r.snapshot.generated_at}`);
  lines.push(`Total Tier ≥ 1: ${r.snapshot.total_tier1_plus}`);
  lines.push(`Previous snapshot: ${r.previous?.generated_at ?? "(none)"}`);
  if (r.flagged.length === 0) {
    lines.push(`\nNo civs dropped > ${FLAG_THRESHOLD_PP} pp share. ✓`);
  } else {
    lines.push(
      `\nFlagged (share dropped > ${FLAG_THRESHOLD_PP} pp):`,
    );
    for (const f of r.flagged) {
      lines.push(
        `  ✗ ${f.civ.padEnd(40)} ${f.prev_pct.toFixed(2)}% → ${f.now_pct.toFixed(2)}% (−${f.drop_pp.toFixed(2)}pp)`,
      );
    }
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  const r = await runCoverageDiff();
  if (json) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(fmtConsole(r));
  }
  await db.$client.end();
}

// Only run main when invoked as a CLI script (not when imported as a module).
const isCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] != null &&
  /coverage-diff\.ts$/.test(process.argv[1]);
if (isCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
