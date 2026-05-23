#!/usr/bin/env tsx
/**
 * Run the fact-check worker on every Tier 2 entity that hasn't been
 * reviewed yet. Sequential — at ~$0.005-0.01/entity, 340 entries ≈
 * $1.70-3.40 total, well inside the daily budget cap.
 *
 * Usage:
 *   pnpm tsx scripts/fact-check-all.ts
 *   pnpm tsx scripts/fact-check-all.ts --limit=10
 *   pnpm tsx scripts/fact-check-all.ts --rerun     # ignore prior reviews
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { factCheckEntity } from "../pipeline/workers/fact-check";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  let limit: number | null = null;
  let rerun = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a === "--rerun") {
      rerun = true;
    }
  }

  // Pick Tier 2 entities. If !rerun, skip those that already have a
  // review row.
  const rows = await db.execute<{ qid: string; name: string }>(sql`
    SELECT e.qid, e.name
    FROM entities e
    WHERE e.tier >= 2
      ${rerun
        ? sql``
        : sql`AND NOT EXISTS (SELECT 1 FROM fact_check_reviews r WHERE r.entity_qid = e.qid)`}
    ORDER BY e.inbound_link_count DESC, e.qid ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
  const list = Array.from(rows);

  console.log(`Fact-checking ${list.length} Tier 2 entries…\n`);

  let clean = 0;
  let flagged = 0;
  let skipped = 0;
  let failed = 0;
  let totalCost = 0;
  let totalFindings = 0;

  for (const row of list) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const r = await factCheckEntity(row.qid);
      totalCost += r.costUsd ?? 0;
      if (r.status === "clean") {
        clean += 1;
        console.log(
          `✓  no findings  $${(r.costUsd ?? 0).toFixed(5)}`,
        );
      } else if (r.status === "flagged") {
        flagged += 1;
        totalFindings += r.findings?.length ?? 0;
        console.log(
          `⚠  ${r.findings?.length ?? 0} flag${r.findings?.length === 1 ? "" : "s"}  $${(r.costUsd ?? 0).toFixed(5)}`,
        );
      } else {
        skipped += 1;
        console.log(`—  ${r.status}`);
      }
    } catch (err) {
      failed += 1;
      if (err instanceof BudgetExceeded) {
        console.log("✗  BUDGET EXCEEDED; stopping");
        break;
      }
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\n${clean} clean  ·  ${flagged} flagged (${totalFindings} total findings)  ·  ${skipped} skipped  ·  ${failed} failed`,
  );
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
