#!/usr/bin/env tsx
/**
 * Seed ~30 curated, historically-significant entities via Wikidata's
 * REST `Special:EntityData/<QID>.json` endpoint. Bypasses the bulk
 * dump entirely — useful for getting enough data into the UI to make
 * the timeline/map/graph/search components feel populated before the
 * 80 GB Wikidata dump is downloaded.
 *
 * The curated list is intentionally anti-Western: 5 sub-Saharan African,
 * 6 MENA/Persia, 4 South Asian, 6 East Asian, 1 steppe, 4 Americas,
 * 3 European, 4 cross-cutting events/places.
 *
 * Each item is resolved to a QID via the Wikipedia summary REST endpoint
 * (which returns `wikibase_item`), then the full Wikidata entity is
 * fetched and run through the existing parser. Idempotent — re-running
 * is safe (ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   pnpm tsx scripts/seed-curated.ts
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

interface CuratedItem {
  wikipediaTitle: string;
  /** Soft tag — actual region is derived later from P17/coords */
  bucket: string;
}

// Anti-Western by design: 26 non-European, 3 European.
const CURATED: CuratedItem[] = [
  // --- Sub-Saharan Africa ---
  { wikipediaTitle: "Sundiata Keita", bucket: "West African Empires" },
  { wikipediaTitle: "Mali Empire", bucket: "West African Empires" },
  { wikipediaTitle: "Kingdom of Aksum", bucket: "East African Civilizations" },
  { wikipediaTitle: "Great Zimbabwe", bucket: "Southern African Civilizations" },
  { wikipediaTitle: "Shaka", bucket: "Southern African Civilizations" },

  // --- MENA / Persia / Caucasus ---
  { wikipediaTitle: "Saladin", bucket: "Islamic Caliphates" },
  { wikipediaTitle: "Suleiman the Magnificent", bucket: "Ottoman Empire" },
  { wikipediaTitle: "Avicenna", bucket: "Islamic Caliphates" },
  { wikipediaTitle: "Cleopatra", bucket: "Ancient Egypt" },
  { wikipediaTitle: "Cyrus the Great", bucket: "Persian Empires" },
  { wikipediaTitle: "Abbasid Caliphate", bucket: "Islamic Caliphates" },

  // --- South Asia ---
  { wikipediaTitle: "Ashoka", bucket: "Indian Subcontinent Empires" },
  { wikipediaTitle: "Akbar", bucket: "Indian Subcontinent Empires" },
  { wikipediaTitle: "Maurya Empire", bucket: "Indian Subcontinent Empires" },
  { wikipediaTitle: "Vijayanagara Empire", bucket: "Indian Subcontinent Empires" },

  // --- East Asia ---
  { wikipediaTitle: "Confucius", bucket: "East Asian Dynasties" },
  { wikipediaTitle: "Genghis Khan", bucket: "Steppe Empires" },
  { wikipediaTitle: "Qin Shi Huang", bucket: "East Asian Dynasties" },
  { wikipediaTitle: "Wu Zetian", bucket: "East Asian Dynasties" },
  { wikipediaTitle: "Murasaki Shikibu", bucket: "Imperial Japan" },
  { wikipediaTitle: "Hokusai", bucket: "Imperial Japan" },

  // --- Steppe / Central Asia ---
  { wikipediaTitle: "Timur", bucket: "Steppe Empires" },

  // --- Americas ---
  { wikipediaTitle: "Pachacuti", bucket: "Andean Civilizations" },
  { wikipediaTitle: "Tupac Amaru II", bucket: "Andean Civilizations" },
  { wikipediaTitle: "Tenochtitlan", bucket: "Mesoamerican" },
  { wikipediaTitle: "Maya civilization", bucket: "Mesoamerican" },

  // --- Europe (capped at 3) ---
  { wikipediaTitle: "Alexander the Great", bucket: "Classical Greece" },
  { wikipediaTitle: "Charlemagne", bucket: "Medieval Europe" },

  // --- Cross-cutting events / places ---
  { wikipediaTitle: "Late Bronze Age collapse", bucket: "Cross-cutting" },
  { wikipediaTitle: "Black Death", bucket: "Cross-cutting" },
  { wikipediaTitle: "Silk Road", bucket: "Cross-cutting" },
  { wikipediaTitle: "Battle of Tondibi", bucket: "West African Empires" },
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

async function seedOne(item: CuratedItem): Promise<{
  status: "ok" | "no_qid" | "no_entity" | "no_type" | "no_name" | "skipped";
  qid?: string;
  name?: string;
  type?: string;
}> {
  const summary = await fetchSummary(item.wikipediaTitle);
  if (!summary?.wikibaseItem) return { status: "no_qid" };
  const qid = summary.wikibaseItem;

  await sleep(250);
  const wd = await fetchWikidataEntity(qid);
  if (!wd) return { status: "no_entity", qid };

  // For curated items we DON'T enforce the seed filter — these are
  // hand-picked. We only need a recognized type and a name.
  const type = getEntityType(wd.claims);
  if (!type) return { status: "no_type", qid };
  const name = getName(wd.labels);
  if (!name) return { status: "no_name", qid };

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

  return { status: "ok", qid, name, type };
}

async function main(): Promise<void> {
  console.log(`Seeding ${CURATED.length} curated entities…\n`);

  let ok = 0;
  let failed = 0;
  for (const item of CURATED) {
    process.stdout.write(`  ${item.wikipediaTitle.padEnd(36)} `);
    try {
      const r = await seedOne(item);
      if (r.status === "ok") {
        ok += 1;
        console.log(`✓  ${r.qid}  ${r.name} (${r.type})`);
      } else {
        failed += 1;
        console.log(`—  ${r.status}${r.qid ? ` (${r.qid})` : ""}`);
      }
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(250);
  }

  console.log(`\n${ok}/${CURATED.length} seeded successfully.`);
  if (failed > 0) console.log(`${failed} failed or skipped.`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
