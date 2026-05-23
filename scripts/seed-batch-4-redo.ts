#!/usr/bin/env tsx
/**
 * Retry the entries that batch 4 skipped because their P31 wasn't in
 * the type whitelist. After expanding TYPE_WHITELIST to include trade
 * routes, societal collapse, ice age, and a couple more religion-flavoured
 * P31 targets, these should now go through.
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
  "Sikhism",
  "Bronze Age collapse",
  "Little Ice Age",
  "Silk Road",
  "Indian Ocean trade",
  "Trans-Saharan trade",
  // Also retry: Pueblo people, Powhatan Confederacy, Lapita culture, etc.
  // which previously failed with no_type for similar reasons.
  "Pueblo people",
  "Powhatan Confederacy",
  "Lapita culture",
  "Hopewell tradition",
  "Ancestral Puebloans",
  "Toltec",
  "Bushido",
  "Stoicism",
  "Confucianism",
  "Taoism",
  "Zoroastrianism",
  "Hinduism",
  "Buddhism",
  "Islam",
  "Christianity",
  "Judaism",
  "Jainism",
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
  console.log(`Retrying ${TITLES.length} previously-skipped entries…\n`);
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
