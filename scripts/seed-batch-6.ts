#!/usr/bin/env tsx
/**
 * Sixth seed batch — final fill targeting the civilizations flagged by
 * the coverage audit (pipeline/audit/coverage-report.ts) as the thinnest
 * remaining: Bronze Age Aegean (1), Bantu Expansion (1), Bronze Age
 * Collapse (4), Ottoman Empire (4), Modern Europe (5), Late
 * Antique/Byzantine (6).
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
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

const TITLES: string[] = [
  // --- Bronze Age Aegean (~6) ---
  "Knossos",
  "Mycenae",
  "Linear B",
  "Minoan civilization",
  "Cycladic culture",
  "Heinrich Schliemann",

  // --- Bantu Expansion + Iron Age Africa (~4) ---
  "Bantu peoples",
  "Nok culture",
  "Iron Age",
  "Bantu expansion",

  // --- Bronze Age Collapse (~3) ---
  "Hittite Empire",
  "Sea Peoples",
  "Mitanni",

  // --- Ottoman Empire (~5) ---
  "Suleiman the Magnificent",
  "Janissary",
  "Topkapı Palace",
  "Tanzimat",
  "Battle of Vienna",

  // --- Modern Europe (~6) ---
  "Otto von Bismarck",
  "Giuseppe Garibaldi",
  "Napoleon",
  "Concert of Europe",
  "Belle Époque",
  "Franz Joseph I of Austria",

  // --- Late Antique / Byzantine (~6) ---
  "Theodora",
  "Belisarius",
  "Heraclius",
  "Battle of Manzikert",
  "Anna Komnene",
  "Iconoclasm",
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

  await sleep(200);
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
  console.log(`Seeding ${TITLES.length} audit-driven entries…\n`);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const title of TITLES) {
    process.stdout.write(`  ${title.padEnd(36)} `);
    try {
      const r = await seedOne(title);
      if (r.status === "ok") {
        ok += 1;
        console.log(`✓  ${r.qid}  ${r.name} (${r.type})`);
      } else {
        skipped += 1;
        console.log(`—  ${r.status}${"qid" in r ? ` (${r.qid})` : ""}`);
      }
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(200);
  }
  console.log(
    `\n${ok}/${TITLES.length} seeded  ·  ${skipped} skipped  ·  ${failed} failed`,
  );
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
