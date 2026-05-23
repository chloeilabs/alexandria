#!/usr/bin/env tsx
/**
 * Fourth curated-seed batch — fills the regions and eras the prior batches
 * thinned out:
 *   - Indus Valley + Mesopotamia (Sumer / Akkad / Assyria / Bronze Age levant)
 *   - Vedic, Mauryan, Gupta, Chola, Vijayanagara India
 *   - Korean kingdoms (Goguryeo, Baekje, Silla, Goryeo, Joseon figures)
 *   - Pre-Columbian North America (Cahokia kept; adding Hopewell, Anasazi,
 *     Powhatan, Quanah Parker, Tecumseh)
 *   - Andean depth (Tiwanaku, Wari, Chimor, Pachacuti, Manco Cápac)
 *   - Mesoamerica depth (Tikal, Palenque, Yax Pasaj, La Venta)
 *   - Polynesia / Austronesia (Tupaia, Kupe, Lapita, Tonga, Aotearoa)
 *   - Pre-Islamic Arabia (Saba, Himyarite, Petra)
 *   - Industrial Revolution + 19th-c. world figures
 *   - Concepts: religions, philosophies, technologies (Islam, Buddhism,
 *     Confucianism, Taoism, Stoicism, Bushido, the printing press, gunpowder)
 *
 * Idempotent — ON CONFLICT DO NOTHING. Reuses the same fetch + insert path
 * as the prior seed batches.
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
  // --- Mesopotamia + ancient Near East (~12) ---
  "Sumer",
  "Akkadian Empire",
  "Assyria",
  "Neo-Assyrian Empire",
  "Neo-Babylonian Empire",
  "Hittites",
  "Ugarit",
  "Phoenicia",
  "Cyrus the Great",
  "Cambyses II",
  "Ashurbanipal",
  "Nebuchadnezzar II",

  // --- Indus Valley + Vedic + Mauryan + Gupta + Southern India (~16) ---
  "Ashoka",
  "Chandragupta Maurya",
  "Kanishka",
  "Samudragupta",
  "Chandragupta II",
  "Harshavardhana",
  "Rajaraja I",
  "Vijayanagara Empire",
  "Pallava dynasty",
  "Pandya dynasty",
  "Hampi",
  "Kalinga War",
  "Battle of Plassey",
  "Akbar",
  "Sher Shah Suri",
  "Nalanda mahavihara",

  // --- Korea (~7) ---
  "Baekje",
  "Sui–Goguryeo War",
  "Yi Sun-sin",
  "Wang Geon",
  "Gwanggaeto the Great",
  "Imjin War",
  "Chosŏn Min'guk",

  // --- Pre-Columbian North America (~10) ---
  "Hopewell tradition",
  "Ancestral Puebloans",
  "Chaco Canyon",
  "Mesa Verde National Park",
  "Pueblo people",
  "Powhatan Confederacy",
  "Tecumseh",
  "Quanah Parker",
  "Crazy Horse",
  "Pontiac (Ottawa leader)",

  // --- Mesoamerica depth (~8) ---
  "Tikal",
  "Palenque",
  "Yax K'uk' Mo'",
  "Maya civilization",
  "Toltec",
  "Aztec Empire",
  "Moctezuma II",
  "Cuauhtémoc",

  // --- Andean depth (~9) ---
  "Tiwanaku",
  "Wari Empire",
  "Chimor",
  "Pachacuti",
  "Manco Cápac",
  "Atahualpa",
  "Inca civil war",
  "Túpac Inca Yupanqui",
  "Caral",

  // --- Polynesia / Austronesia / Pacific (~9) ---
  "Lapita culture",
  "Tupaia (navigator)",
  "Kupe",
  "Tonga",
  "Samoa",
  "Tahitian Kingdom",
  "Rapa Nui people",
  "Aotearoa",
  "Māori people",

  // --- Pre-Islamic Arabia + ancient Yemen (~5) ---
  "Saba (kingdom)",
  "Himyarite Kingdom",
  "Petra",
  "Nabataean Kingdom",
  "Lakhmids",

  // --- East African + Indian Ocean trade (~6) ---
  "Aksumite Empire",
  "Kingdom of Kush",
  "Meroë",
  "Punt",
  "Swahili coast",
  "Sofala",

  // --- Sub-Saharan Africa depth (~6) ---
  "Great Zimbabwe",
  "Kingdom of Kongo",
  "Queen Nzinga",
  "Kingdom of Lunda",
  "Kingdom of Aksum",
  "Tippu Tip",

  // --- Steppe / Inner Asia (~5) ---
  "Xiongnu",
  "Göktürk Khaganate",
  "Tang–Tibet War",
  "Tibetan Empire",
  "Songtsen Gampo",

  // --- 19th-century world + Industrial Revolution (~12) ---
  "James Watt",
  "Steam engine",
  "Spinning jenny",
  "Telegraph",
  "Charles Darwin",
  "Florence Nightingale",
  "Frederick Douglass",
  "Harriet Tubman",
  "Sojourner Truth",
  "American Civil War",
  "Abolitionism",
  "Suffragette",

  // --- Religions / philosophies / concepts (~10) ---
  "Buddhism",
  "Hinduism",
  "Confucianism",
  "Taoism",
  "Zoroastrianism",
  "Islam",
  "Christianity",
  "Judaism",
  "Sikhism",
  "Jainism",

  // --- Cross-cutting world events / movements (~6) ---
  "Bronze Age collapse",
  "Black Death",
  "Little Ice Age",
  "Silk Road",
  "Indian Ocean trade",
  "Trans-Saharan trade",
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
  console.log(`Seeding ${TITLES.length} entities…\n`);
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
