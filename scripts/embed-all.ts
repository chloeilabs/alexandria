#!/usr/bin/env tsx
/**
 * Embed every entity that doesn't yet have a vector.
 *
 * Sequential. Each call hits AI Gateway's Voyage 3 large endpoint. Honors
 * DAILY_BUDGET_USD via the budget guard inside embedEntity.
 *
 * Usage:
 *   pnpm tsx scripts/embed-all.ts                # everything missing
 *   pnpm tsx scripts/embed-all.ts --limit=50     # cap the run
 *   pnpm tsx scripts/embed-all.ts --force        # re-embed everything
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { embedEntity } from "../pipeline/workers/embed";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  let limit: number | null = null;
  let force = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a === "--force") {
      force = true;
    }
  }

  const rows = await db.execute<{ qid: string; name: string }>(sql`
    SELECT qid, name FROM entities
    ${force ? sql`` : sql`WHERE embedding IS NULL`}
    ORDER BY inbound_link_count DESC, tier DESC, qid ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);

  const list = Array.from(rows);
  console.log(
    `Embedding ${list.length} ${force ? "entities (force re-embed)" : "entities missing vectors"}…\n`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of list) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const r = await embedEntity(row.qid, { force });
      if (r.status === "ok") {
        ok += 1;
        totalCost += r.costUsd ?? 0;
        console.log(
          `✓  ${r.dim}d  ${r.tokens}t  $${(r.costUsd ?? 0).toFixed(6)}`,
        );
      } else if (r.status === "already_done") {
        skipped += 1;
        console.log("·  already embedded");
      } else {
        failed += 1;
        console.log(`✗  ${r.status}`);
      }
    } catch (err) {
      failed += 1;
      if (err instanceof BudgetExceeded) {
        console.log(`✗  BUDGET EXCEEDED ($${err.spent.toFixed(2)} spent today); stopping`);
        break;
      }
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\n${ok} embedded  ·  ${skipped} skipped  ·  ${failed} failed`,
  );
  console.log(`Total spend this run: $${totalCost.toFixed(6)}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
