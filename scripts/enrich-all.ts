#!/usr/bin/env tsx
/**
 * Sequentially enrich every Tier 0 entity to Tier 1.
 *
 * For bulk continuous enrichment, use `pnpm pipeline` (boots pg-boss).
 * This script is for ad-hoc one-shot runs when you want predictable
 * sequential behavior + a tidy summary line per entity.
 *
 * Honors DAILY_BUDGET_USD via the budget guard inside summarizeEntity —
 * if the cap is hit mid-run, the rest of the entities will throw.
 *
 * Usage:
 *   pnpm tsx scripts/enrich-all.ts                # all Tier 0 entities
 *   pnpm tsx scripts/enrich-all.ts --limit=10     # cap the run
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities } from "../lib/db/schema";
import { summarizeEntity } from "../pipeline/workers/summarize";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  let limit: number | null = null;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    }
  }

  const rows = await db
    .select({ qid: entities.qid, name: entities.name })
    .from(entities)
    .where(eq(entities.tier, 0))
    .orderBy(sql`${entities.inboundLinkCount} DESC, ${entities.qid} ASC`)
    .limit(limit ?? 10_000);

  console.log(`Enriching ${rows.length} Tier 0 entities to Tier 1…\n`);

  let ok = 0;
  let skipped = 0;
  let noSource = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of rows) {
    process.stdout.write(`  ${row.qid.padEnd(10)} ${row.name.slice(0, 32).padEnd(32)} `);
    try {
      const r = await summarizeEntity(row.qid);
      if (r.status === "ok") {
        ok += 1;
        totalCost += r.costUsd ?? 0;
        console.log(
          `✓  ${r.summary?.length ?? 0} chars  $${(r.costUsd ?? 0).toFixed(4)}`,
        );
      } else if (r.status === "no_source") {
        noSource += 1;
        console.log("—  no Wikipedia article");
      } else if (r.status === "already_done") {
        skipped += 1;
        console.log("·  already Tier 1+");
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
    `\n${ok} enriched  ·  ${skipped} skipped  ·  ${noSource} no source  ·  ${failed} failed`,
  );
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
