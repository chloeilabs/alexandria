#!/usr/bin/env tsx
/**
 * Walk every Tier 2+ entity, probe the Internet Archive for a pre-1924
 * English public-domain text, and persist any hit into the `sources`
 * table (kind = internet_archive).
 *
 * No AI spend — just IA + Open Library fetches. Idempotent: skips
 * entities that already have an `internet_archive` source row.
 *
 * Run this BEFORE turning IA on in narrate, to measure realistic
 * coverage and surface issues before bulk re-narrate burns budget.
 *
 * Usage:
 *   pnpm tsx scripts/probe-ia-coverage.ts
 *   pnpm tsx scripts/probe-ia-coverage.ts --limit=50
 *   pnpm tsx scripts/probe-ia-coverage.ts --qid=Q9438     # single entity
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { sources } from "../lib/db/schema";
import {
  fetchInternetArchive,
  type EntityHintType,
} from "../lib/internet-archive";

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
  let qidFilter: string | null = null;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a.startsWith("--qid=")) {
      qidFilter = a.slice("--qid=".length);
    }
  }

  const rows = qidFilter
    ? await db.execute<{ qid: string; name: string; type: string }>(sql`
        SELECT qid, name, type FROM entities WHERE qid = ${qidFilter}
      `)
    : await db.execute<{ qid: string; name: string; type: string }>(sql`
        SELECT e.qid, e.name, e.type
        FROM entities e
        WHERE e.tier >= 2
          AND NOT EXISTS (
            SELECT 1 FROM sources s
            WHERE s.entity_qid = e.qid AND s.source_kind = 'internet_archive'
          )
        ORDER BY e.inbound_link_count DESC, e.qid ASC
        ${limit ? sql`LIMIT ${limit}` : sql``}
      `);
  const list = Array.from(rows);

  console.log(`Probing Internet Archive for ${list.length} entities…\n`);

  let hits = 0;
  let misses = 0;
  let failed = 0;

  for (const r of list) {
    process.stdout.write(
      `  ${r.qid.padEnd(10)} ${r.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      const hint = TYPE_HINT[r.type];
      const article = await fetchInternetArchive(r.name, hint);
      if (article) {
        await db
          .insert(sources)
          .values({
            entityQid: r.qid,
            sourceKind: "internet_archive",
            url: article.url,
            content: article.text,
            license: "Public domain",
          })
          .onConflictDoNothing({
            target: [sources.entityQid, sources.sourceKind],
          });
        hits += 1;
        const yr = article.year ? ` ${article.year}` : "";
        const who = article.creator ? `, ${article.creator.slice(0, 24)}` : "";
        console.log(
          `✓  ${article.text.length.toString().padStart(5)}c  ${article.title.slice(0, 40)}${who}${yr}`,
        );
      } else {
        misses += 1;
        console.log("—  no usable IA text");
      }
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    // Be a polite IA client — 5/s ceiling matches the wikisource probe.
    await sleep(200);
  }

  console.log(
    `\n${hits} IA entries persisted  ·  ${misses} no IA fit  ·  ${failed} failed`,
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
