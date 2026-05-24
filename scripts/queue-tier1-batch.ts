#!/usr/bin/env tsx
/**
 * Phase 2 enqueuer for Tier 1 (Wikidata stub → Wikipedia-lead summary).
 *
 * Reads the `enrichment_priority` table (populated by
 * `pipeline/audit/coverage-report.ts --write-priority`), groups candidates
 * by civilizational tag, applies a per-tag quota = floor(target / 47),
 * and enqueues each picked qid into pg-boss queue `tier1.summarize`.
 *
 * Anti-Western-bias key: per-tag quotas are uniform — Western civs get
 * the same floor as Bantu / Austronesian / Andean. Partial buckets fill
 * to exhaustion (don't refuse small civs). Quota-at-queue-build prevents
 * a 10× imbalance from forming in the underlying corpus.
 *
 * Usage:
 *   pnpm tsx scripts/queue-tier1-batch.ts                      # default 50K/47
 *   pnpm tsx scripts/queue-tier1-batch.ts --target=10000        # custom total
 *   pnpm tsx scripts/queue-tier1-batch.ts --per-civ=500         # custom per-civ cap
 *   pnpm tsx scripts/queue-tier1-batch.ts --dry-run             # report only
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { boss, startQueue, stopQueue } from "../pipeline/queue";
import { QUEUE_SUMMARIZE } from "../pipeline/workers";

const NUM_CIV_TAGS = 47;
const DEFAULT_TARGET = 50_000;

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
  const cap =
    args.perCiv ?? Math.max(1, Math.floor(args.target / NUM_CIV_TAGS));

  console.log(
    `Tier 1 enqueue: target=${args.target}  per-civ cap=${cap}  ${args.dryRun ? "(DRY RUN)" : ""}\n`,
  );

  // Pull (civ, qid) candidates ranked by inbound-link centrality within
  // each civ-bucket. enrichment_priority's rank_in_bucket is exactly
  // that ordering (see pipeline/audit/coverage-report.ts:writePriorityQueue).
  const rows = await db.execute<{
    civilizational_tag: string;
    qid: string;
    rank_in_bucket: number;
  }>(sql`
    SELECT civilizational_tag, qid, rank_in_bucket
    FROM enrichment_priority
    WHERE target_tier = 1
    ORDER BY civilizational_tag, rank_in_bucket
  `);

  // Bucket by civ; pick first `cap` from each.
  const byCiv = new Map<string, string[]>();
  for (const r of rows) {
    const list = byCiv.get(r.civilizational_tag) ?? [];
    if (list.length < cap) list.push(r.qid);
    byCiv.set(r.civilizational_tag, list);
  }

  const picked: { civ: string; qid: string }[] = [];
  for (const [civ, qids] of byCiv) {
    for (const qid of qids) picked.push({ civ, qid });
  }

  // Report per-civ plan.
  const civCounts = Array.from(byCiv.entries())
    .map(([civ, qids]) => ({ civ, n: qids.length }))
    .sort((a, b) => b.n - a.n);
  console.log("per-civ picked:");
  for (const c of civCounts) {
    console.log(`  ${c.civ.padEnd(40)} ${String(c.n).padStart(5)}`);
  }
  console.log(
    `\nTotal: ${picked.length} qids across ${civCounts.length} civ tags`,
  );

  if (args.dryRun) {
    await db.$client.end();
    return;
  }

  // Enqueue. Each job is { qid }; the worker (pipeline/workers/index.ts)
  // calls summarizeEntity(qid). Budget gate inside summarizeEntity prevents
  // runaway spend; pg-boss retries on BudgetExceeded.
  await startQueue();
  console.log("\nEnqueueing…");
  let enqueued = 0;
  for (const p of picked) {
    await boss.send(QUEUE_SUMMARIZE, { qid: p.qid });
    enqueued += 1;
    if (enqueued % 500 === 0) console.log(`  ${enqueued}/${picked.length}`);
  }
  console.log(`✓ Enqueued ${enqueued} jobs to ${QUEUE_SUMMARIZE}`);

  await stopQueue();
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
