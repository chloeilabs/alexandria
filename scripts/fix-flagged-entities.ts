#!/usr/bin/env tsx
/**
 * Find the Tier 2 entities with the most flagged claims and re-narrate +
 * re-fact-check them. The hypothesis: high-flag-count entities have
 * narratives that wandered off the sources; a fresh narrate pass with
 * the same prompt usually lands closer to ground because the model
 * doesn't have its own previous output to anchor on.
 *
 * Usage:
 *   pnpm tsx scripts/fix-flagged-entities.ts          # top 10
 *   pnpm tsx scripts/fix-flagged-entities.ts --limit=20
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { narrateEntity } from "../pipeline/workers/narrate";
import { factCheckEntity } from "../pipeline/workers/fact-check";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  let limit = 10;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    }
  }

  // Tier 2 entities with the most flagged claims, descending. Skip
  // Tier 3 (already hand-curated; their narratives are deliberately
  // different).
  const rows = await db.execute<{
    qid: string;
    name: string;
    slug: string;
    flag_count: number;
  }>(sql`
    SELECT e.qid, e.name, e.slug,
           jsonb_array_length(r.flagged_claims) AS flag_count
    FROM entities e
    JOIN fact_check_reviews r ON r.entity_qid = e.qid
    WHERE r.status = 'flagged'
      AND e.tier = 2
    ORDER BY jsonb_array_length(r.flagged_claims) DESC
    LIMIT ${limit}
  `);
  const list = Array.from(rows);

  console.log(
    `Re-narrating + re-fact-checking ${list.length} worst-flagged Tier 2 entries…\n`,
  );

  let improved = 0;
  let unchanged = 0;
  let worse = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of list) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 30).padEnd(30)} ${String(row.flag_count).padStart(3)} → `,
    );
    try {
      const nr = await narrateEntity(row.qid, { force: true });
      if (nr.status !== "ok") {
        failed += 1;
        console.log(`✗  narrate ${nr.status}`);
        continue;
      }
      totalCost += nr.costUsd ?? 0;

      const fr = await factCheckEntity(row.qid);
      totalCost += fr.costUsd ?? 0;

      const newCount = fr.findings?.length ?? 0;
      if (newCount < row.flag_count) {
        improved += 1;
        console.log(
          `✓  ${String(newCount).padStart(2)} (-${row.flag_count - newCount})  $${(nr.costUsd ?? 0).toFixed(4)}+$${(fr.costUsd ?? 0).toFixed(4)}`,
        );
      } else if (newCount === row.flag_count) {
        unchanged += 1;
        console.log(`·  ${newCount} (no change)`);
      } else {
        worse += 1;
        console.log(`✗  ${newCount} (+${newCount - row.flag_count})`);
      }
    } catch (err) {
      failed += 1;
      if (err instanceof BudgetExceeded) {
        console.log("BUDGET EXCEEDED; stopping");
        break;
      }
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\n${improved} improved  ·  ${unchanged} unchanged  ·  ${worse} worse  ·  ${failed} failed`,
  );
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
