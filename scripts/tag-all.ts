#!/usr/bin/env tsx
/**
 * Classify every entity into civilizational tags.
 * Idempotent: re-running on already-tagged entities is cheap (the unique
 * index on entity_regions absorbs duplicates), but we additionally skip
 * any entity that already has a civilizational tag.
 *
 * Usage:
 *   pnpm tsx scripts/tag-all.ts
 *   pnpm tsx scripts/tag-all.ts --limit=10
 *   pnpm tsx scripts/tag-all.ts --redo    # re-classify even if already tagged
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities, entityRegions } from "../lib/db/schema";
import { classifyEntity } from "../pipeline/workers/tag";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  let limit: number | null = null;
  let redo = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a === "--redo") {
      redo = true;
    }
  }

  // QIDs that already have a civilizational tag.
  const taggedQids = redo
    ? new Set<string>()
    : new Set(
        (
          await db
            .selectDistinct({ qid: entityRegions.entityQid })
            .from(entityRegions)
            .where(eq(entityRegions.regionKind, "civilizational"))
        ).map((r) => r.qid),
      );

  const rows = await db
    .select({
      qid: entities.qid,
      name: entities.name,
      type: entities.type,
    })
    .from(entities)
    .orderBy(sql`${entities.inboundLinkCount} DESC, ${entities.qid} ASC`)
    .limit(limit ?? 10_000);

  const todo = rows.filter((r) => !taggedQids.has(r.qid));
  console.log(
    `${todo.length} entities to classify (${rows.length - todo.length} already tagged).\n`,
  );

  let ok = 0;
  let none = 0;
  let failed = 0;
  let totalCost = 0;

  for (const row of todo) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const r = await classifyEntity(row.qid);
      totalCost += r.costUsd ?? 0;
      if (r.status === "ok") {
        ok += 1;
        console.log(
          `[${r.tags?.join(", ") ?? ""}]  $${(r.costUsd ?? 0).toFixed(4)}`,
        );
      } else if (r.status === "no_tags") {
        none += 1;
        console.log(`—  no fit  $${(r.costUsd ?? 0).toFixed(4)}`);
      } else {
        failed += 1;
        console.log(`✗  ${r.status}`);
      }
    } catch (err) {
      failed += 1;
      if (err instanceof BudgetExceeded) {
        console.log(`✗  BUDGET EXCEEDED; stopping`);
        break;
      }
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${ok} tagged  ·  ${none} no-fit  ·  ${failed} failed`);
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
