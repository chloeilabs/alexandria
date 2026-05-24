#!/usr/bin/env tsx
/**
 * Seventh seed batch — anti-Western-bias density push.
 *
 * The coverage audit (May 2026) showed these civilizations
 * sitting at <10 entries each, well below the median:
 *   - bantu-expansion (2)
 *   - austronesian-expansion (7)
 *   - indus-valley-civilization (7)
 *   - delhi-sultanate-and-mughal (8)
 *   - pre-columbian-north-american (8)
 *   - mongol-empire-and-successors (9)
 *   - mughal/southern-indian/southeast-asian (~9)
 *   - vedic-and-mauryan (9)
 *   - pre-islamic-arabia (9)
 *
 * Western/European civs sit at 12–21. This batch is deliberately
 * non-European to enforce the anti-Western-bias commitment that
 * runs through every layer of the project.
 *
 * The seed-batch pattern: take a Wikipedia title, hit the
 * Wikipedia REST API for the wikibaseItem, fetch the Wikidata
 * entity, parse it through the same extractors the bulk pipeline
 * uses, insert as Tier 0. The enrich/narrate chain then upgrades.
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
  // --- Bantu expansion + sub-Saharan + central African (gap: 2/9/9) ---
  "Great Zimbabwe",
  "Kingdom of Kongo",
  "Kingdom of Mutapa",
  "Ife",
  "Kanem–Bornu Empire",
  "Buganda",
  "Kingdom of Benin",
  "Luba Kingdom",
  "Lunda Kingdom",

  // --- Austronesian + Polynesian expansion (gap: 7/11) ---
  "Lapita culture",
  "Easter Island",
  "Hawaiian Kingdom",
  "Tonga",
  "Outrigger canoe",
  "Austronesian peoples",
  "Madagascar",
  "Kingdom of Tahiti",

  // --- Indus Valley (gap: 7) ---
  "Harappa",
  "Mohenjo-daro",
  "Lothal",
  "Dholavira",
  "Indus script",
  "Kalibangan",

  // --- Mongol Empire + successors (gap: 9) ---
  "Golden Horde",
  "Ilkhanate",
  "Yuan dynasty",
  "Timur",
  "Timurid Empire",
  "Battle of Ain Jalut",

  // --- Mughal + Delhi Sultanate (gap: 8) ---
  "Shah Jahan",
  "Aurangzeb",
  "Babur",
  "Delhi Sultanate",
  "Taj Mahal",
  "Humayun",
  "Jahangir",
  "Razia Sultana",

  // --- Southeast Asian empires (gap: 9) ---
  "Angkor Wat",
  "Khmer Empire",
  "Srivijaya",
  "Majapahit",
  "Ayutthaya Kingdom",
  "Pagan Kingdom",
  "Suryavarman II",
  "Borobudur",
  "Champa",

  // --- Southern Indian empires (gap: 9) ---
  "Chola dynasty",
  "Vijayanagara Empire",
  "Pallava dynasty",
  "Hampi",
  "Krishnadevaraya",
  "Rajaraja I",

  // --- Vedic + Mauryan (gap: 9) ---
  "Chandragupta Maurya",
  "Magadha",
  "Mahajanapadas",

  // --- Pre-Columbian North American (gap: 8) ---
  "Cahokia",
  "Mesa Verde National Park",
  "Pueblo Bonito",
  "Mississippian culture",
  "Hopewell tradition",
  "Chaco Canyon",

  // --- Pre-Islamic Arabia (gap: 9) ---
  "Kingdom of Saba",
  "Nabataean Kingdom",
  "Himyarite Kingdom",
  "Lakhmid kingdom",
  "Ghassanid kingdom",
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
  console.log(`Seeding ${TITLES.length} non-European entries (anti-bias batch)…\n`);
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
