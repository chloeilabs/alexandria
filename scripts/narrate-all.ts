#!/usr/bin/env tsx
/**
 * Upgrade every Tier 1 entity to Tier 2.
 * Honors the daily budget cap inside narrateEntity.
 *
 * Usage:
 *   pnpm tsx scripts/narrate-all.ts
 *   pnpm tsx scripts/narrate-all.ts --limit=10
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities } from "../lib/db/schema";
import { narrateEntity } from "../pipeline/workers/narrate";
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
    .where(eq(entities.tier, 1))
    .orderBy(sql`${entities.inboundLinkCount} DESC, ${entities.qid} ASC`)
    .limit(limit ?? 10_000);

  console.log(`Narrating ${rows.length} Tier 1 entities to Tier 2…\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of rows) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const r = await narrateEntity(row.qid);
      if (r.status === "ok") {
        ok += 1;
        totalCost += r.costUsd ?? 0;
        console.log(
          `✓  ${r.narrative?.length ?? 0} chars  $${(r.costUsd ?? 0).toFixed(4)}`,
        );
      } else if (r.status === "already_done") {
        skipped += 1;
        console.log("·  already Tier 2");
      } else {
        failed += 1;
        console.log(`✗  ${r.status}`);
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

  console.log(`\n${ok} narrated  ·  ${skipped} skipped  ·  ${failed} failed`);
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
