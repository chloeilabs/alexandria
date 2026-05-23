#!/usr/bin/env tsx
/**
 * Re-narrate every Tier 2 entity that has a britannica_1911 source row
 * but whose narrative was authored without it (i.e. its
 * source_attribution doesn't already list britannica_1911).
 *
 * Skips entities the previous anchor pass already rebuilt with the
 * multi-source prompt. Honors the daily budget cap.
 *
 * Usage:
 *   pnpm tsx scripts/narrate-britannica-rerun.ts
 *   pnpm tsx scripts/narrate-britannica-rerun.ts --limit=10
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
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

  // Entities at Tier 2 with a stored britannica_1911 source whose
  // existing source_attribution doesn't already mention britannica.
  const rows = await db.execute<{ qid: string; name: string }>(sql`
    SELECT e.qid, e.name
    FROM entities e
    JOIN sources s ON s.entity_qid = e.qid AND s.source_kind = 'britannica_1911'
    WHERE e.tier >= 2
      AND COALESCE(
        NOT (e.source_attribution::text LIKE '%britannica_1911%'),
        true
      )
    ORDER BY e.inbound_link_count DESC, e.qid ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
  const list = Array.from(rows);

  console.log(
    `Re-narrating ${list.length} Tier 2 entries with Britannica multi-source synthesis…\n`,
  );

  let okBoth = 0;
  let okWp = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of list) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const r = await narrateEntity(row.qid, { force: true });
      if (r.status === "ok") {
        const both = r.sourceKinds?.includes("britannica_1911") ?? false;
        if (both) okBoth += 1;
        else okWp += 1;
        totalCost += r.costUsd ?? 0;
        console.log(
          `${both ? "✓✓" : "✓ "}  ${r.narrative?.length ?? 0}c  $${(r.costUsd ?? 0).toFixed(4)}`,
        );
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

  console.log(
    `\n${okBoth} multi-source  ·  ${okWp} wikipedia-only  ·  ${failed} failed`,
  );
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
