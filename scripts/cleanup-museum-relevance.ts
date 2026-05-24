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
import { media } from "../lib/db/schema";
import {
  dateWindowAccepts,
  isNaturalScienceSource,
  looksLikeTaxonomicSpecimen,
  nameMatchesHaystack,
} from "../lib/media/relevance";

// Note: the BCE-country-heritage check (lib/media/relevance.ts
// bceCountryHeritageAccepts) is intentionally NOT applied here. The
// cleanup script only has the persisted caption + attribution to work
// from; the original Europeana `country` field isn't preserved as a
// separate column. Captions look like "title · year · provider ·
// country" but year and country are often missing, so the trailing
// token isn't reliably the country. The live filter in
// lib/europeana/index.ts enforces the heritage rule for new fetches;
// retroactive cleanup of older Europeana rows on BCE entities needs
// a targeted DELETE by known-bad caption signature.

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Pull museum-source rows joined with their entity context (incl.
  // date range) so the date-window filter has the signal it needs.
  const rows = await db.execute<{
    id: number;
    entity_qid: string;
    entity_name: string;
    date_start: number | null;
    date_end: number | null;
    attribution: string;
    caption: string | null;
  }>(sql`
    SELECT
      m.id,
      m.entity_qid,
      e.name AS entity_name,
      e.date_start,
      e.date_end,
      m.attribution,
      m.caption
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

  const toDelete: { id: number; reason: string }[] = [];
  for (const r of list) {
    const caption = r.caption ?? "";
    const haystack = [r.attribution, caption].join(" ");
    let reason: string | null = null;
    if (!nameMatchesHaystack(r.entity_name, haystack)) {
      reason = "no name match";
    } else if (looksLikeTaxonomicSpecimen(caption)) {
      reason = "taxonomic specimen title";
    } else if (isNaturalScienceSource(r.attribution, caption)) {
      reason = "natural-science source";
    } else if (!dateWindowAccepts(r.date_start, r.date_end, caption)) {
      // Only check the caption — attribution strings include URLs like
      // /item/12345/abc1850 where the digits look like years but aren't.
      reason = "date out of window";
    }
    if (reason) {
      toDelete.push({ id: r.id, reason });
      console.log(
        `  drop  ${r.entity_qid.padEnd(10)} ${r.entity_name.slice(0, 22).padEnd(22)} ` +
          `[${reason}]  caption="${caption.slice(0, 56)}"`,
      );
    }
  }

  console.log(
    `\n${toDelete.length} rows fail relevance check (of ${list.length} museum rows)`,
  );

  if (apply && toDelete.length > 0) {
    const ids = toDelete.map((d) => d.id);
    await db.delete(media).where(inArray(media.id, ids));
    console.log(`Deleted ${toDelete.length} rows.`);
  } else if (toDelete.length > 0) {
    console.log("Re-run with --apply to delete.");
  }

  // Side-check: are any entities now orphaned (zero media rows)? Just
  // print the count for awareness; we don't act on it.
  if (apply && toDelete.length > 0) {
    const deletedIds = new Set(toDelete.map((d) => d.id));
    const affectedQids = [
      ...new Set(
        list.filter((r) => deletedIds.has(r.id)).map((r) => r.entity_qid),
      ),
    ];
    let stillHasOther = 0;
    for (const qid of affectedQids) {
      const remaining = await db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.entityQid, qid))
        .limit(1);
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
