#!/usr/bin/env tsx
/**
 * One-shot cleanup: re-apply the shared name-relevance check to every
 * existing museum-sourced media row in the DB. Anything that no longer
 * passes (the Akbar botanicals, etc.) gets deleted.
 *
 * Identifies museum rows by license in {CC0, open} OR by attribution
 * containing one of the museum source markers. Skips Commons rows.
 *
 * Dry-run by default; pass --apply to actually delete.
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-museum-relevance.ts             # dry-run
 *   pnpm tsx scripts/cleanup-museum-relevance.ts --apply     # delete
 */
import "../lib/env";
import { sql, eq, inArray } from "drizzle-orm";

import { db } from "../lib/db";
import { entities, media } from "../lib/db/schema";
import { nameMatchesHaystack } from "../lib/media/relevance";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Pull museum-source rows joined with their entity name.
  const rows = await db.execute<{
    id: number;
    entity_qid: string;
    entity_name: string;
    attribution: string;
    caption: string | null;
  }>(sql`
    SELECT m.id, m.entity_qid, e.name AS entity_name, m.attribution, m.caption
    FROM media m
    JOIN entities e ON e.qid = m.entity_qid
    WHERE
      m.attribution ILIKE '%Metropolitan Museum%'
      OR m.attribution ILIKE '%Smithsonian Open Access%'
      OR m.attribution ILIKE '%Europeana%'
  `);
  const list = Array.from(rows);
  console.log(
    `Re-validating ${list.length} museum-source media rows ` +
      `(${apply ? "APPLY: will delete failures" : "dry-run: no deletes"})\n`,
  );

  const toDelete: number[] = [];
  for (const r of list) {
    const haystack = [r.attribution, r.caption ?? ""].join(" ");
    if (!nameMatchesHaystack(r.entity_name, haystack)) {
      toDelete.push(r.id);
      console.log(
        `  drop  ${r.entity_qid.padEnd(10)} ${r.entity_name.slice(0, 22).padEnd(22)} ` +
          `caption="${(r.caption ?? "").slice(0, 60)}"`,
      );
    }
  }

  console.log(
    `\n${toDelete.length} rows fail relevance check (of ${list.length} museum rows)`,
  );

  if (apply && toDelete.length > 0) {
    await db.delete(media).where(inArray(media.id, toDelete));
    console.log(`Deleted ${toDelete.length} rows.`);
  } else if (toDelete.length > 0) {
    console.log("Re-run with --apply to delete.");
  }

  // Side-check: are any entities now orphaned (zero media rows)? Just
  // print the count for awareness; we don't act on it.
  if (apply && toDelete.length > 0) {
    const affectedQids = [...new Set(list.filter((r) => toDelete.includes(r.id)).map((r) => r.entity_qid))];
    let stillHasOther = 0;
    for (const qid of affectedQids) {
      const remaining = await db.select({ id: media.id }).from(media).where(eq(media.entityQid, qid)).limit(1);
      if (remaining.length > 0) stillHasOther += 1;
    }
    console.log(
      `${stillHasOther} of ${affectedQids.length} affected entities still have other media.`,
    );
  }

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
