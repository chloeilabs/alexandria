#!/usr/bin/env tsx
/**
 * Promote a curated list of entities from the local bulk Wikidata DB
 * to Neon production, then run the standard enrichment chain
 * (summarize → narrate → tag → embed → fetch-media → fact-check).
 *
 * Workflow:
 *   1. The PROMOTE_QIDS list below is hand-picked from the local
 *      coverage audit + the high-inbound-count query.
 *   2. For each QID, read the row from local Docker Postgres
 *      (entities + entity_aliases + relationships) and insert into
 *      Neon. We trust the bulk dump's metadata so we don't re-fetch
 *      Wikidata.
 *   3. Run the enrichment chain on the new entities only.
 *
 * Why this script and not extending one of the seed-batch scripts:
 *   - The seed-batch scripts take Wikipedia titles and re-fetch
 *     both Wikipedia + Wikidata. Wasteful when we already have the
 *     Wikidata data locally. This script reads from local DB.
 *   - This is also the prototype for the eventual "promote a subset"
 *     decision point in the bulk-dump flow.
 *
 * Usage:
 *   pnpm tsx scripts/promote-from-bulk.ts
 *   pnpm tsx scripts/promote-from-bulk.ts --from-priority-queue=20
 *
 * The `--from-priority-queue=N` flag replaces PROMOTE_QIDS with the top
 * N qids from `enrichment_priority` on Neon (target_tier=1, ordered by
 * deficit_score DESC then rank_in_bucket). The QIDs are looked up in the
 * local bulk DB; ones not present in bulk are skipped. Useful once the
 * priority table has been populated by `coverage-report --write-priority`.
 */
import "../lib/env";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  entities,
  entityAliases,
  relationships,
} from "../lib/db/schema";

// 15 hand-picked entries from the local bulk DB. Mix of pre-1500
// historical places (Ottoman, Constantinople, Acre, Medina, Ryukyu),
// medieval polities (Polish-Lithuanian Commonwealth), and a couple
// modern places with deep historical layers (Mexico City).
const PROMOTE_QIDS = [
  "Q12560",   // Ottoman Empire
  "Q16869",   // Constantinople
  "Q1489",    // Mexico City
  "Q172107",  // Polish-Lithuanian Commonwealth
  "Q45670",   // Kingdom of Portugal
  "Q35484",   // Medina
  "Q83958",   // Macedonia (ancient)
  "Q126084",  // Acre
  "Q28025",   // Ryukyu Kingdom
  "Q160544",  // Heraklion
  "Q47492",   // Gaza City
  "Q4120832", // Königsberg
  "Q186285",  // University of Copenhagen
  "Q230104",  // Nakhchivan
  "Q79808",   // Constanța
];

const LOCAL_DB_URL =
  "postgresql://library:changeme@localhost:5434/library";

function parseFromPriorityQueue(argv: readonly string[]): number | null {
  for (const a of argv) {
    if (a.startsWith("--from-priority-queue=")) {
      const n = parseInt(a.slice("--from-priority-queue=".length), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

async function resolveCandidateQids(): Promise<string[]> {
  const fromPriority = parseFromPriorityQueue(process.argv.slice(2));
  if (fromPriority == null) return [...PROMOTE_QIDS];

  const rows = await db.execute<{ qid: string }>(sql`
    SELECT qid FROM enrichment_priority
    WHERE target_tier = 1
    ORDER BY deficit_score DESC, rank_in_bucket
    LIMIT ${fromPriority}
  `);
  const qids = Array.from(rows).map((r) => r.qid);
  console.log(
    `(--from-priority-queue=${fromPriority}: ${qids.length} qids from enrichment_priority)`,
  );
  return qids;
}

async function main(): Promise<void> {
  const candidateQids = await resolveCandidateQids();
  console.log(
    `Promoting ${candidateQids.length} entities from bulk to Neon…\n`,
  );

  // 1. Read everything we need from local Postgres in one shot.
  interface EntityRow {
    qid: string;
    slug: string;
    name: string;
    type: string;
    date_start: number | null;
    date_start_precision: string | null;
    date_end: number | null;
    date_end_precision: string | null;
    latitude: number | null;
    longitude: number | null;
  }
  const localSql = postgres(LOCAL_DB_URL, { prepare: false });
  const localEntities = (await localSql<EntityRow[]>`
    SELECT qid, slug, name, type,
           date_start, date_start_precision,
           date_end, date_end_precision,
           latitude, longitude
    FROM entities
    WHERE qid = ANY(${candidateQids}::text[])
  `) as unknown as EntityRow[];

  if (localEntities.length === 0) {
    console.error("No matching entities in local bulk DB — has the ingest produced these QIDs yet?");
    await localSql.end();
    await db.$client.end();
    process.exit(1);
  }

  const foundQids = localEntities.map((e) => e.qid);
  const missingFromLocal = candidateQids.filter(
    (q) => !foundQids.includes(q),
  );
  if (missingFromLocal.length > 0) {
    console.log(
      `(skipping ${missingFromLocal.length} QIDs not yet in local bulk DB: ${missingFromLocal.join(", ")})`,
    );
  }

  // Pull aliases + relationships for the entities we have.
  interface AliasRow {
    entity_qid: string;
    alias: string;
    language: string;
  }
  interface RelRow {
    source_qid: string;
    target_qid: string;
    predicate: string;
    qualifiers: unknown;
  }
  const aliasRowsList = (await localSql<AliasRow[]>`
    SELECT entity_qid, alias, language FROM entity_aliases WHERE entity_qid = ANY(${foundQids}::text[])
  `) as unknown as AliasRow[];
  const relRowsList = (await localSql<RelRow[]>`
    SELECT source_qid, target_qid, predicate, qualifiers FROM relationships WHERE source_qid = ANY(${foundQids}::text[])
  `) as unknown as RelRow[];

  await localSql.end();

  // 2. Insert into Neon. ON CONFLICT DO NOTHING so re-running is safe.
  console.log("\nInserting into Neon production:");
  let inserted = 0;
  for (const e of localEntities) {
    const exists = await db
      .select({ qid: entities.qid })
      .from(entities)
      .where(eq(entities.qid, e.qid))
      .limit(1);
    if (exists.length > 0) {
      console.log(`  ${e.qid.padEnd(10)} ${e.name.padEnd(32)} ·  already in Neon`);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(entities)
        .values({
          qid: e.qid,
          slug: e.slug,
          name: e.name,
          type: e.type,
          tier: 0,
          dateStart: e.date_start,
          dateStartPrecision: e.date_start_precision,
          dateEnd: e.date_end,
          dateEndPrecision: e.date_end_precision,
          latitude: e.latitude,
          longitude: e.longitude,
        })
        .onConflictDoNothing({ target: entities.qid });

      const myAliases = aliasRowsList.filter((a) => a.entity_qid === e.qid);
      if (myAliases.length > 0) {
        await tx
          .insert(entityAliases)
          .values(
            myAliases.map((a) => ({
              entityQid: a.entity_qid,
              alias: a.alias,
              language: a.language,
            })),
          )
          .onConflictDoNothing();
      }

      const myRels = relRowsList.filter(
        (r: RelRow) => r.source_qid === e.qid,
      );
      if (myRels.length > 0) {
        await tx
          .insert(relationships)
          .values(
            myRels.map((r: RelRow) => ({
              sourceQid: r.source_qid,
              targetQid: r.target_qid,
              predicate: r.predicate,
              qualifiers: r.qualifiers as Record<string, unknown> | null,
            })),
          )
          .onConflictDoNothing();
      }
    });

    inserted += 1;
    const aliasCount = aliasRowsList.filter(
      (a: AliasRow) => a.entity_qid === e.qid,
    ).length;
    const relCount = relRowsList.filter(
      (r: RelRow) => r.source_qid === e.qid,
    ).length;
    console.log(
      `  ${e.qid.padEnd(10)} ${e.name.padEnd(32)} ✓  ${aliasCount} aliases  ${relCount} rels`,
    );
  }

  console.log(
    `\nInserted ${inserted} new entities. Run the standard chain now:`,
  );
  console.log(`  pnpm tsx scripts/enrich-all.ts   # Tier 0 → 1`);
  console.log(`  pnpm tsx scripts/narrate-all.ts  # Tier 1 → 2`);
  console.log(`  pnpm tsx scripts/tag-all.ts      # civ tags`);
  console.log(`  pnpm tsx scripts/embed-all.ts    # voyage embeddings`);
  console.log(`  pnpm tsx scripts/fetch-media.ts  # commons heroes`);
  console.log(`  pnpm tsx scripts/fact-check-all.ts # fact-check pass`);
  console.log(`  pnpm tsx scripts/rebuild-slugs.ts  # promote unique slugs`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
