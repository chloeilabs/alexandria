#!/usr/bin/env tsx
/**
 * Walk every entity, probe Wikisource for a 1911-Britannica article,
 * and persist any hit into the `sources` table (kind = britannica_1911).
 *
 * No AI spend — just Wikisource fetches. Idempotent: skips entities
 * that already have a britannica_1911 source row.
 *
 * After this, scripts/narrate-britannica-only.ts can re-narrate just
 * the entities where Britannica genuinely adds value, without churning
 * the ones it can't improve.
 *
 * Usage:
 *   pnpm tsx scripts/probe-britannica-coverage.ts
 *   pnpm tsx scripts/probe-britannica-coverage.ts --limit=50
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { sources } from "../lib/db/schema";
import {
  fetchBritannica1911,
  type EntityHintType,
} from "../lib/wikisource";

const TYPE_HINT: Record<string, EntityHintType> = {
  person: "person",
  place: "place",
  event: "event",
  organization: "organization",
  work: "work",
  concept: "concept",
};

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main(): Promise<void> {
  let limit: number | null = null;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    }
  }

  // Entities at Tier 2 that DON'T already have a britannica_1911 source.
  const rows = await db.execute<{ qid: string; name: string; type: string }>(sql`
    SELECT e.qid, e.name, e.type
    FROM entities e
    WHERE e.tier >= 2
      AND NOT EXISTS (
        SELECT 1 FROM sources s
        WHERE s.entity_qid = e.qid AND s.source_kind = 'britannica_1911'
      )
    ORDER BY e.inbound_link_count DESC, e.qid ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
  const list = Array.from(rows);

  console.log(`Probing Wikisource for ${list.length} entities…\n`);

  let hits = 0;
  let misses = 0;
  let failed = 0;

  for (const r of list) {
    process.stdout.write(
      `  ${r.qid.padEnd(10)} ${r.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const hint = TYPE_HINT[r.type];
      const article = await fetchBritannica1911(r.name, hint);
      if (article) {
        await db
          .insert(sources)
          .values({
            entityQid: r.qid,
            sourceKind: "britannica_1911",
            url: article.url,
            content: article.text,
            license: "Public domain",
          })
          .onConflictDoNothing({
            target: [sources.entityQid, sources.sourceKind],
          });
        hits += 1;
        const t = article.title.replace("1911 Encyclopædia Britannica/", "");
        console.log(`✓  ${article.text.length}c  ${t.slice(0, 40)}`);
      } else {
        misses += 1;
        console.log("—  no entry");
      }
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    // Be a polite Wikisource client — 5/s ceiling.
    await sleep(200);
  }

  console.log(
    `\n${hits} britannica entries persisted  ·  ${misses} not in 1911 Britannica  ·  ${failed} failed`,
  );
  console.log(
    `Hit rate: ${list.length > 0 ? Math.round((hits / list.length) * 100) : 0}%`,
  );

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
