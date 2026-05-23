#!/usr/bin/env tsx
/**
 * Re-narrate the 10 anchor entities with Britannica wired in. Used to
 * eyeball the prose quality before deciding whether to re-narrate the
 * whole corpus.
 *
 * Honors the daily budget cap inside narrateEntity.
 *
 * Usage:
 *   pnpm tsx scripts/narrate-with-britannica.ts
 *   pnpm tsx scripts/narrate-with-britannica.ts --all      # re-do all Tier 2
 *   pnpm tsx scripts/narrate-with-britannica.ts --limit=5
 */
import "../lib/env";
import { sql, eq, inArray } from "drizzle-orm";

import { db } from "../lib/db";
import { entities } from "../lib/db/schema";
import { narrateEntity } from "../pipeline/workers/narrate";
import { BudgetExceeded } from "../pipeline/budget";

const ANCHOR_SLUGS = [
  "hannibal",
  "mansa-musa",
  "wu-zetian",
  "tupac-amaru-ii",
  "hatshepsut",
  "saladin",
  "murasaki-shikibu",
  "akbar",
  "bronze-age-collapse",
  "songhai-empire",
];

async function main(): Promise<void> {
  let limit: number | null = null;
  let all = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a === "--all") {
      all = true;
    }
  }

  const rows = all
    ? await db
        .select({ qid: entities.qid, name: entities.name, slug: entities.slug })
        .from(entities)
        .where(eq(entities.tier, 2))
        .orderBy(sql`${entities.inboundLinkCount} DESC, ${entities.qid} ASC`)
        .limit(limit ?? 10_000)
    : await db
        .select({ qid: entities.qid, name: entities.name, slug: entities.slug })
        .from(entities)
        .where(inArray(entities.slug, ANCHOR_SLUGS));

  console.log(
    `Re-narrating ${rows.length} entries with Wikipedia + Britannica synthesis…\n`,
  );

  let okBoth = 0;
  let okWp = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of rows) {
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
