#!/usr/bin/env tsx
/**
 * Walk every entity, hit the Wikipedia summary REST endpoint, and
 * persist any thumbnail / original-image URL into the media table.
 *
 * The image is NOT downloaded locally — we serve it through next/image
 * directly from upload.wikimedia.org (allowed by next.config.ts
 * remotePatterns). Saves disk; Next handles resizing + caching.
 *
 * Idempotent: ON CONFLICT DO NOTHING on (commons_url) unique index.
 * Re-running adds anything new and skips already-stored entries.
 *
 * Usage:
 *   pnpm tsx scripts/fetch-media.ts
 *   pnpm tsx scripts/fetch-media.ts --limit=10
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities, media } from "../lib/db/schema";
import { fetchSummary } from "../lib/wikipedia";

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

  // Skip entities that already have a media row.
  const haveMedia = new Set(
    (
      await db.selectDistinct({ qid: media.entityQid }).from(media)
    ).map((r) => r.qid),
  );

  const rows = await db
    .select({ qid: entities.qid, name: entities.name })
    .from(entities)
    .orderBy(sql`${entities.inboundLinkCount} DESC, ${entities.qid} ASC`)
    .limit(limit ?? 10_000);

  const todo = rows.filter((r) => !haveMedia.has(r.qid));
  console.log(
    `${todo.length} entities to fetch media for (${rows.length - todo.length} already have media).\n`,
  );

  let ok = 0;
  let none = 0;
  let failed = 0;

  for (const row of todo) {
    process.stdout.write(
      `  ${row.qid.padEnd(10)} ${row.name.slice(0, 36).padEnd(36)} `,
    );
    try {
      const summary = await fetchSummary(row.name, { qid: row.qid });
      if (!summary?.originalUrl) {
        none += 1;
        console.log("—  no image");
        await sleep(150);
        continue;
      }
      await db
        .insert(media)
        .values({
          entityQid: row.qid,
          commonsUrl: summary.originalUrl,
          kind: "image",
          license: "see Wikimedia Commons",
          attribution: `Wikimedia Commons · ${summary.title}`,
        })
        .onConflictDoNothing();

      ok += 1;
      const dim =
        summary.originalWidth && summary.originalHeight
          ? `${summary.originalWidth}×${summary.originalHeight}`
          : "?";
      console.log(`✓  ${dim}`);
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(150);
  }

  console.log(`\n${ok} fetched  ·  ${none} no image  ·  ${failed} failed`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
