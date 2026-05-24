#!/usr/bin/env tsx
/**
 * Phase 2 enqueuer for Tier 2 (summary → multi-source narrative).
 *
 * Same shape as queue-tier1-batch.ts but for target_tier=2. Western civs
 * that already dominate the curated 359-entry Tier 2 corpus get a smaller
 * fresh quota so the new Tier 2 push corrects the existing skew rather
 * than amplifying it.
 *
 * Usage:
 *   pnpm tsx scripts/queue-tier2-priority.ts                      # default 30K/47
 *   pnpm tsx scripts/queue-tier2-priority.ts --target=5000         # custom total
 *   pnpm tsx scripts/queue-tier2-priority.ts --per-civ=200         # custom cap
 *   pnpm tsx scripts/queue-tier2-priority.ts --dry-run
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { boss, startQueue, stopQueue } from "../pipeline/queue";
import { QUEUE_NARRATE } from "../pipeline/workers";

const NUM_CIV_TAGS = 47;
const DEFAULT_TARGET = 30_000;

// Civs that already dominate the curated Tier 2 corpus. Their per-civ
// quota is reduced so the new T2 push doesn't widen their lead.
const OVER_NARRATED_CIVS = new Set<string>([
  "modern-europe",
  "classical-greek",
  "classical-roman",
]);
const OVER_NARRATED_CAP_RATIO = 0.6;

interface Args {
  target: number;
  perCiv: number | null;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const out: Args = {
    target: DEFAULT_TARGET,
    perCiv: null,
    dryRun: false,
  };
  for (const a of argv) {
    if (a.startsWith("--target=")) {
      const n = parseInt(a.slice("--target=".length), 10);
      if (Number.isFinite(n) && n > 0) out.target = n;
    } else if (a.startsWith("--per-civ=")) {
      const n = parseInt(a.slice("--per-civ=".length), 10);
      if (Number.isFinite(n) && n > 0) out.perCiv = n;
    } else if (a === "--dry-run") {
      out.dryRun = true;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const baseCap =
    args.perCiv ?? Math.max(1, Math.floor(args.target / NUM_CIV_TAGS));
  const overCap = Math.max(1, Math.floor(baseCap * OVER_NARRATED_CAP_RATIO));

  console.log(
    `Tier 2 enqueue: target=${args.target}  base cap=${baseCap}  over-narrated cap=${overCap}  ${args.dryRun ? "(DRY RUN)" : ""}\n`,
  );

  const rows = await db.execute<{
    civilizational_tag: string;
    qid: string;
    rank_in_bucket: number;
  }>(sql`
    SELECT civilizational_tag, qid, rank_in_bucket
    FROM enrichment_priority
    WHERE target_tier = 2
    ORDER BY civilizational_tag, rank_in_bucket
  `);

  const byCiv = new Map<string, string[]>();
  for (const r of rows) {
    const cap = OVER_NARRATED_CIVS.has(r.civilizational_tag)
      ? overCap
      : baseCap;
    const list = byCiv.get(r.civilizational_tag) ?? [];
    if (list.length < cap) list.push(r.qid);
    byCiv.set(r.civilizational_tag, list);
  }

  const picked: { civ: string; qid: string }[] = [];
  for (const [civ, qids] of byCiv) {
    for (const qid of qids) picked.push({ civ, qid });
  }

  const civCounts = Array.from(byCiv.entries())
    .map(([civ, qids]) => ({
      civ,
      n: qids.length,
      capped: OVER_NARRATED_CIVS.has(civ),
    }))
    .sort((a, b) => b.n - a.n);
  console.log("per-civ picked (✱ = over-narrated, lower cap):");
  for (const c of civCounts) {
    const marker = c.capped ? "✱" : " ";
    console.log(`  ${marker} ${c.civ.padEnd(40)} ${String(c.n).padStart(5)}`);
  }
  console.log(
    `\nTotal: ${picked.length} qids across ${civCounts.length} civ tags`,
  );

  if (args.dryRun) {
    await db.$client.end();
    return;
  }

  await startQueue();
  // Idempotent — creates pgboss schema + queue on first invocation.
  await boss.createQueue(QUEUE_NARRATE);
  console.log("\nEnqueueing…");
  let enqueued = 0;
  for (const p of picked) {
    await boss.send(QUEUE_NARRATE, { qid: p.qid });
    enqueued += 1;
    if (enqueued % 500 === 0) console.log(`  ${enqueued}/${picked.length}`);
  }
  console.log(`✓ Enqueued ${enqueued} jobs to ${QUEUE_NARRATE}`);

  await stopQueue();
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
