#!/usr/bin/env tsx
/**
 * Fifth seed batch — targeted fill of the regions still under-represented
 * after batch 4 + concept additions:
 *
 *   - Indus Valley (Q1059) had 1 entity → add Dholavira, Kalibangan,
 *     Rakhigarhi, Lothal, Ganweriwala, Mehrgarh.
 *   - Caribbean & circum-Caribbean (2) → Cuba Taino, Boukman, Henri
 *     Christophe, Christophe Colomb (already in), Maroons, Garifuna,
 *     Dessalines.
 *   - Central African Kingdoms (4) → Kuba Kingdom, Luba Kingdom,
 *     Loango Kingdom, Bakongo, Kingdom of Ndongo (with Nzinga already
 *     in), Kanem-Bornu (already in).
 *   - Polynesian (8) → Hōkūleʻa, Cook Islands, Niʻihau, Pomare dynasty,
 *     Polynesian navigation, Tongan Empire, Kamehameha II.
 *   - Pre-Columbian NA (6) → Cahokia (in), Hopewell tradition (in),
 *     Adena, Mississippian culture (in), Anasazi, Iroquois Confederacy
 *     (in), Crow nation, Lakota.
 *   - Andean (9) → Norte Chico, Chavín de Huántar, Moche, Wari (in),
 *     Tiwanaku (in), Chimor (in), Inca road system, Kuelap.
 *   - Southern African (5) → Mapungubwe, Khoisan, Mfecane, Lobengula,
 *     Moshoeshoe I, Shaka Zulu (in).
 *   - Industrial Revolution (6) → George Stephenson, Eli Whitney,
 *     Cotton gin, Power loom, Bessemer process, Suez Canal.
 *   - Pre-Islamic Arabia (6) → Aksumite invasion of Yemen, Battle of
 *     Dhi Qar, Imru' al-Qais, Lakhmids (in), Ghassanids, Quraysh.
 *   - Korean kingdoms (10) → Wang Geon (in), Sejong (in), Hideyoshi
 *     invasion (in), Donghak revolt, Empress Myeongseong.
 *
 * Idempotent — ON CONFLICT DO NOTHING. Skips entries already in the
 * corpus regardless of source slug.
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
  // --- Indus Valley (~6) ---
  "Dholavira",
  "Kalibangan",
  "Rakhigarhi",
  "Lothal",
  "Ganweriwala",
  "Mehrgarh",

  // --- Caribbean (~6) ---
  "Taíno",
  "Dutty Boukman",
  "Jean-Jacques Dessalines",
  "Henri Christophe",
  "Maroons",
  "Garifuna",

  // --- Central African Kingdoms (~5) ---
  "Kuba Kingdom",
  "Luba Empire",
  "Loango Kingdom",
  "Kingdom of Ndongo",
  "Bakongo",

  // --- Polynesia / Pacific (~6) ---
  "Hōkūleʻa",
  "Cook Islands",
  "Pomare dynasty",
  "Polynesian navigation",
  "Tu'i Tonga Empire",
  "Kamehameha II",

  // --- Pre-Columbian North America (~5) ---
  "Adena culture",
  "Ancestral Pueblo",
  "Crow Nation",
  "Lakota people",
  "Mississippian culture",

  // --- Andean (~5) ---
  "Norte Chico civilization",
  "Chavín culture",
  "Moche culture",
  "Inca road system",
  "Kuelap",

  // --- Southern African (~5) ---
  "Mapungubwe",
  "Khoisan",
  "Mfecane",
  "Lobengula",
  "Moshoeshoe I",

  // --- Industrial Revolution (~6) ---
  "George Stephenson",
  "Eli Whitney",
  "Cotton gin",
  "Power loom",
  "Bessemer process",
  "Suez Canal",

  // --- Pre-Islamic Arabia (~4) ---
  "Imru' al-Qais",
  "Ghassanids",
  "Quraysh",
  "Aksumite invasion of Himyar",

  // --- Korean (~2) ---
  "Donghak Peasant Revolution",
  "Empress Myeongseong",

  // --- Bronze Age Collapse pieces (~3) ---
  "Sea Peoples",
  "Mycenaean Greece",
  "Late Bronze Age collapse",
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
  console.log(`Seeding ${TITLES.length} entities targeting thin regions…\n`);
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
