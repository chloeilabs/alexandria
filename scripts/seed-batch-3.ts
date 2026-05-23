#!/usr/bin/env tsx
/**
 * Third curated-seed batch — corpus density push from 60 to ~230 entries.
 *
 * Curation strategy: ~70/30 non-Western/Western, mix of persons / places
 * / events / works, span all major eras from Bronze Age to 20th century.
 * Entries chosen for clear Wikipedia presence (so Tier 1 enrichment via
 * REST works) and historical weight (so Tier 2 prose has something to
 * synthesize).
 *
 * Idempotent — re-running is safe. Reuses the same fetch + insert path
 * as seed-curated.ts and seed-extra.ts.
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

const TITLES: string[] = [
  // --- Sub-Saharan Africa (~20) ---
  "Ghana Empire",
  "Kingdom of Benin",
  "Ashanti Empire",
  "Oyo Empire",
  "Buganda",
  "Ethiopian Empire",
  "Menelik II",
  "Haile Selassie",
  "Patrice Lumumba",
  "Nelson Mandela",
  "Timbuktu",
  "Djenné",
  "Lalibela",
  "Olaudah Equiano",
  "Nzinga of Ndongo and Matamba",
  "Kanem–Bornu Empire",
  "Cetshwayo",
  "Mutapa Empire",
  "Sokoto Caliphate",
  "Kilwa Kisiwani",

  // --- MENA / Persia / Caucasus (~22) ---
  "Tutankhamun",
  "Nefertiti",
  "Akhenaten",
  "Hammurabi",
  "Sargon of Akkad",
  "Darius the Great",
  "Xerxes I",
  "Alexandria",
  "Cairo",
  "Baghdad",
  "Mecca",
  "Persepolis",
  "Ibn Khaldun",
  "Al-Khwarizmi",
  "Muhammad ibn Zakariya al-Razi",
  "Averroes",
  "Rumi",
  "Hafez",
  "Sasanian Empire",
  "Fatimid Caliphate",
  "Umayyad Caliphate",
  "Mamluk Sultanate",
  "Mehmed II",
  "Selim I",
  "Fall of Constantinople",

  // --- South Asia (~16) ---
  "Chola dynasty",
  "Gupta Empire",
  "Krishnadevaraya",
  "Tipu Sultan",
  "Aurangzeb",
  "Shah Jahan",
  "Taj Mahal",
  "Babur",
  "Indus Valley Civilisation",
  "Mohenjo-daro",
  "Harappa",
  "Mahatma Gandhi",
  "Rabindranath Tagore",
  "B. R. Ambedkar",
  "Jawaharlal Nehru",
  "Anuradhapura",

  // --- East Asia (~25) ---
  "Sun Tzu",
  "Laozi",
  "Mencius",
  "Mao Zedong",
  "Sun Yat-sen",
  "Tokugawa Ieyasu",
  "Oda Nobunaga",
  "Toyotomi Hideyoshi",
  "Meiji Restoration",
  "Sengoku period",
  "Heian period",
  "Kamakura shogunate",
  "Qing dynasty",
  "Empress Dowager Cixi",
  "Sejong the Great",
  "Goguryeo",
  "Joseon",
  "Silla",
  "Goryeo",
  "Yuan dynasty",
  "Kublai Khan",
  "Liu Bang",
  "Cao Cao",
  "Xuanzang",
  "Koxinga",
  "Yongle Emperor",
  "Taiping Rebellion",

  // --- Steppe / Central Asia (~7) ---
  "Attila",
  "Golden Horde",
  "Ilkhanate",
  "Bukhara",
  "Samarkand",
  "Hephthalites",
  "Mongol invasion of Europe",

  // --- Southeast Asia / Oceania (~12) ---
  "Angkor Wat",
  "Srivijaya",
  "Majapahit",
  "Borobudur",
  "Pagan Kingdom",
  "Sukhothai Kingdom",
  "Ayutthaya Kingdom",
  "Trưng sisters",
  "Lê Lợi",
  "Hawaiian Kingdom",
  "Kamehameha I",
  "Easter Island",

  // --- Europe (capped at ~18) ---
  "Pericles",
  "Herodotus",
  "Augustus",
  "Marcus Aurelius",
  "Constantine the Great",
  "Justinian I",
  "William the Conqueror",
  "Battle of Hastings",
  "Magna Carta",
  "Leonardo da Vinci",
  "Michelangelo",
  "Niccolò Machiavelli",
  "Martin Luther",
  "Galileo Galilei",
  "Isaac Newton",
  "Catherine the Great",
  "Peter the Great",
  "Karl Marx",

  // --- Americas (~22) ---
  "Olmec",
  "Teotihuacan",
  "Mixtec",
  "Zapotec civilization",
  "Pakal the Great",
  "Cahokia",
  "Iroquois Confederacy",
  "Hiawatha",
  "Mississippian culture",
  "Sitting Bull",
  "Geronimo",
  "Hernán Cortés",
  "Francisco Pizarro",
  "Simón Bolívar",
  "José de San Martín",
  "Toussaint Louverture",
  "Haitian Revolution",
  "Mexican Revolution",
  "Emiliano Zapata",
  "Frida Kahlo",
  "Sequoyah",

  // --- Cross-cutting events / themes (~18) ---
  "Atlantic slave trade",
  "Age of Discovery",
  "Columbian exchange",
  "First Crusade",
  "Reconquista",
  "Renaissance",
  "Reformation",
  "French Revolution",
  "American Revolution",
  "Russian Revolution",
  "World War I",
  "World War II",
  "The Holocaust",
  "Cold War",
  "Hundred Years' War",
  "Spanish Inquisition",
  "Industrial Revolution",
  "Scramble for Africa",
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
  let failed = 0;
  for (const title of TITLES) {
    process.stdout.write(`  ${title.padEnd(36)} `);
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
    await sleep(200);
  }
  console.log(`\n${ok}/${TITLES.length} seeded.`);
  if (failed > 0) console.log(`${failed} failed or skipped.`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
