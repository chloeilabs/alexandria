#!/usr/bin/env tsx
/**
 * For each Alexandria entity of type=place, look it up in the World
 * Historical Gazetteer index and persist any non-English name variants
 * into entity_aliases. Variants like "Takht-e Jamshīd" for Persepolis,
 * "Qosqo" for Cuzco, "Tariy" for Tyre — the kind of search-corpus
 * additions that catch users who type a place's local-language name
 * rather than its Wikipedia headword.
 *
 * No coordinate updates here — too risky without per-entity curation;
 * a separate future script can do that under review.
 *
 * No AI spend. WHG bot-filter rejects empty User-Agents; we set one in
 * lib/whg/index.ts. Idempotent: entity_aliases composite unique on
 * (entity_qid, alias, language) skips dupes via onConflictDoNothing.
 *
 * Usage:
 *   pnpm tsx scripts/enrich-whg.ts
 *   pnpm tsx scripts/enrich-whg.ts --limit=50
 *   pnpm tsx scripts/enrich-whg.ts --qid=Q129072
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entityAliases } from "../lib/db/schema";
import { searchByName, type WhgPlace } from "../lib/whg";

interface Args {
  limit: number | null;
  qid: string | null;
}

function parseArgs(): Args {
  const out: Args = { limit: null, qid: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) out.limit = n;
    } else if (a.startsWith("--qid=")) {
      out.qid = a.slice("--qid=".length);
    }
  }
  return out;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Pick the best WHG candidate for an entity. Heavily prefer matches
 * with a higher score, but break ties toward entries that have variants
 * (the whole reason we're enriching) and entries whose title prefix-
 * matches the entity name (cheap relevance proxy against WHG's noisier
 * lower-scored returns).
 */
function pickBest(name: string, candidates: WhgPlace[]): WhgPlace | null {
  if (candidates.length === 0) return null;
  const nameLower = name.toLowerCase();
  const scored = candidates.map((c) => {
    const titleLower = c.title.toLowerCase();
    let bonus = 0;
    if (titleLower === nameLower) bonus += 5;
    else if (titleLower.startsWith(nameLower)) bonus += 2;
    if (c.variants.length > 0) bonus += 1;
    return { c, total: c.score + bonus };
  });
  scored.sort((a, b) => b.total - a.total);
  return scored[0]!.c;
}

async function main(): Promise<void> {
  const args = parseArgs();

  const rows = args.qid
    ? await db.execute<{ qid: string; name: string; type: string }>(sql`
        SELECT qid, name, type FROM entities WHERE qid = ${args.qid}
      `)
    : await db.execute<{ qid: string; name: string; type: string }>(sql`
        SELECT qid, name, type FROM entities
        WHERE type = 'place'
        ORDER BY tier DESC, inbound_link_count DESC, qid ASC
        ${args.limit ? sql`LIMIT ${args.limit}` : sql``}
      `);
  const list = Array.from(rows);

  console.log(
    `Enriching ${list.length} place entities with WHG variants…\n`,
  );

  let hits = 0;
  let aliasesInserted = 0;
  let misses = 0;
  let failed = 0;

  for (const r of list) {
    process.stdout.write(
      `  ${r.qid.padEnd(10)} ${r.name.slice(0, 36).padEnd(36)} `,
    );
    try {
      const candidates = await searchByName(r.name, { limit: 5 });
      if (candidates.length === 0) {
        misses += 1;
        console.log("—  no WHG match");
        await sleep(200);
        continue;
      }
      const best = pickBest(r.name, candidates);
      if (!best || best.variants.length === 0) {
        misses += 1;
        const titles = candidates.slice(0, 2).map((c) => c.title).join(", ");
        console.log(`—  matched (${titles}) but no variants`);
        await sleep(200);
        continue;
      }

      hits += 1;
      let inserted = 0;
      for (const variant of best.variants) {
        const cleaned = variant.trim();
        if (!cleaned) continue;
        const result = await db
          .insert(entityAliases)
          .values({
            entityQid: r.qid,
            alias: cleaned,
            language: "whg",
          })
          .onConflictDoNothing()
          .returning({ id: entityAliases.id });
        if (result.length > 0) inserted += 1;
      }
      aliasesInserted += inserted;
      const preview = best.variants.slice(0, 2).join(", ");
      console.log(
        `✓  whg=${best.placeId} score=${best.score.toFixed(1)}  +${inserted} aliases  [${preview}${best.variants.length > 2 ? "…" : ""}]`,
      );
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(200);
  }

  console.log(
    `\n${hits} WHG matches with variants · ${misses} no usable match · ${failed} failed`,
  );
  console.log(`${aliasesInserted} new aliases persisted to entity_aliases`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
