#!/usr/bin/env tsx
/**
 * Second curated-seed batch. Adds ~25 entities to:
 *   (a) unblock the Hannibal -> Carthage -> Punic Wars -> Roman Republic
 *       navigation chain (acceptance criterion #4);
 *   (b) densify the connection graph and timeline;
 *   (c) broaden region/era coverage (more Americas, more East Asia, more
 *       transformative figures and great travelers).
 *
 * Idempotent — re-running is safe (ON CONFLICT DO NOTHING upserts).
 *
 * Usage:
 *   pnpm tsx scripts/seed-extra.ts
 */
import "../lib/env";

import { db } from "../lib/db";
import {
  entities as entitiesTable,
  entityAliases,
  relationships,
} from "../lib/db/schema";
import { fetchSummary } from "../lib/wikipedia";
import {
  getAliases,
  getCoordinates,
  getDates,
  getEntityType,
  getName,
  getRelationships,
  makeSlug,
  type WdEntity,
} from "../pipeline/bulk/wikidata";

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "LibraryOfAlexandria/0.1 (local development; contact: andrestran@icloud.com)";

const EXTRA: string[] = [
  // Unblock Hannibal -> Carthage -> Punic Wars -> Roman Republic
  "Carthage",
  "Second Punic War",
  "Roman Republic",
  "Roman Empire",

  // More empires (helps "fall of an empire" search)
  "Han dynasty",
  "Tang dynasty",
  "Ming dynasty",
  "Inca Empire",
  "Aztec Empire",
  "Byzantine Empire",
  "Achaemenid Empire",
  "Khmer Empire",
  "Mughal Empire",

  // Transformative figures
  "Gautama Buddha",
  "Muhammad",
  "Plato",
  "Aristotle",
  "Socrates",

  // Great travelers / cross-cutting
  "Ibn Battuta",
  "Zheng He",
  "Marco Polo",

  // More Europe + Americas
  "Napoleon",
  "Joan of Arc",
  "Atahualpa",

  // More MENA
  "Ramses II",
  "Babylon",
];

async function fetchWikidataEntity(qid: string): Promise<WdEntity | null> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { entities?: Record<string, WdEntity> };
  return j.entities?.[qid] ?? null;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function seedOne(title: string) {
  const summary = await fetchSummary(title);
  if (!summary?.wikibaseItem) return { status: "no_qid" as const };
  const qid = summary.wikibaseItem;

  await sleep(250);
  const wd = await fetchWikidataEntity(qid);
  if (!wd) return { status: "no_entity" as const, qid };

  const type = getEntityType(wd.claims);
  if (!type) return { status: "no_type" as const, qid };
  const name = getName(wd.labels);
  if (!name) return { status: "no_name" as const, qid };

  const dates = getDates(wd.claims, type);
  const coords = getCoordinates(wd.claims);
  const aliases = getAliases(wd.labels, wd.aliases, name);
  const rels = getRelationships(wd.claims, qid);

  await db.transaction(async (tx) => {
    await tx
      .insert(entitiesTable)
      .values({
        qid,
        slug: makeSlug(name, qid),
        name,
        type,
        tier: 0,
        dateStart: dates.dateStart,
        dateStartPrecision: dates.dateStartPrecision,
        dateEnd: dates.dateEnd,
        dateEndPrecision: dates.dateEndPrecision,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      })
      .onConflictDoNothing();

    if (aliases.length > 0) {
      await tx
        .insert(entityAliases)
        .values(
          aliases.map((a) => ({
            entityQid: qid,
            alias: a.alias,
            language: a.language,
          })),
        )
        .onConflictDoNothing();
    }

    if (rels.length > 0) {
      await tx
        .insert(relationships)
        .values(
          rels.map((r) => ({
            sourceQid: r.sourceQid,
            targetQid: r.targetQid,
            predicate: r.predicate,
            qualifiers: r.qualifiers,
          })),
        )
        .onConflictDoNothing();
    }
  });

  return { status: "ok" as const, qid, name, type };
}

async function main(): Promise<void> {
  console.log(`Seeding ${EXTRA.length} extra entities…\n`);
  let ok = 0;
  let failed = 0;
  for (const title of EXTRA) {
    process.stdout.write(`  ${title.padEnd(28)} `);
    try {
      const r = await seedOne(title);
      if (r.status === "ok") {
        ok += 1;
        console.log(`✓  ${r.qid}  ${r.name} (${r.type})`);
      } else {
        failed += 1;
        console.log(`—  ${r.status}${"qid" in r ? ` (${r.qid})` : ""}`);
      }
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(250);
  }
  console.log(`\n${ok}/${EXTRA.length} seeded.`);
  if (failed > 0) console.log(`${failed} failed or skipped.`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
