#!/usr/bin/env tsx
/**
 * For each entity, query Europeana for CC-licensed image candidates
 * and persist any new ones to the media table.
 *
 * This is a SEPARATE script from fetch-media.ts so its run cadence is
 * independent — most entities already have a Commons hero, and museum
 * media is additive (lands as media[1+], visible in the Tier 3
 * ArchiveGallery component).
 *
 * Met and Smithsonian were removed on 2026-05-24 to limit the API
 * surface (per [[alexandria-fewer-providers]] feedback). Europeana
 * covers the same need for European medieval/Renaissance manuscripts
 * and prints, has the broadest CC reusability filter, and overlaps
 * comfortably with what Met/Smithsonian were providing.
 *
 * Auth notes:
 *   - Europeana: EUROPEANA_API_KEY required (free at pro.europeana.eu).
 * Returns [] silently when the key is unset.
 *
 * Idempotent: composite unique on (entity_qid, commons_url) means
 * re-running on an entity skips already-stored URLs.
 *
 * Usage:
 *   pnpm tsx scripts/fetch-museum-media.ts
 *   pnpm tsx scripts/fetch-museum-media.ts --limit=50
 *   pnpm tsx scripts/fetch-museum-media.ts --qid=Q9438
 *   pnpm tsx scripts/fetch-museum-media.ts --tier-3-only
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { media } from "../lib/db/schema";
import {
  searchItems as searchEuropeana,
  type EuropeanaObject,
} from "../lib/europeana";

interface Args {
  limit: number | null;
  qid: string | null;
  tier3Only: boolean;
}

function parseArgs(): Args {
  const out: Args = { limit: null, qid: null, tier3Only: false };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) out.limit = n;
    } else if (a.startsWith("--qid=")) {
      out.qid = a.slice("--qid=".length);
    } else if (a === "--tier-3-only") {
      out.tier3Only = true;
    }
  }
  return out;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

interface InsertSource {
  url: string;
  attribution: string;
  caption: string | null;
  license: string;
}

function fromEuropeana(o: EuropeanaObject): InsertSource {
  const captionParts = [o.title, o.year, o.dataProvider, o.country].filter(
    (s): s is string => !!s,
  );
  return {
    url: o.imageUrl,
    attribution: `Europeana (${o.rights ?? "open"}) · ${o.recordUrl}`,
    caption: captionParts.length > 0 ? captionParts.join(" · ") : null,
    license: o.rights ?? "open",
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  const rows = args.qid
    ? await db.execute<{
        qid: string;
        name: string;
        tier: number;
        date_start: number | null;
        date_end: number | null;
      }>(sql`
        SELECT qid, name, tier, date_start, date_end
        FROM entities WHERE qid = ${args.qid}
      `)
    : await db.execute<{
        qid: string;
        name: string;
        tier: number;
        date_start: number | null;
        date_end: number | null;
      }>(sql`
        SELECT qid, name, tier, date_start, date_end
        FROM entities
        WHERE tier >= 2
          ${args.tier3Only ? sql`AND tier = 3` : sql``}
        ORDER BY tier DESC, inbound_link_count DESC, qid ASC
        ${args.limit ? sql`LIMIT ${args.limit}` : sql``}
      `);
  const list = Array.from(rows);

  console.log(
    `Fetching museum media for ${list.length} entities ` +
      `(Europeana key=${process.env.EUROPEANA_API_KEY ? "set" : "absent"})\n`,
  );

  let inserted = 0;
  let entitiesWithHits = 0;
  let failed = 0;

  for (const r of list) {
    process.stdout.write(
      `  ${r.qid.padEnd(10)} T${r.tier} ${r.name.slice(0, 32).padEnd(32)} `,
    );
    try {
      // Entity dates flow into the date-window filter inside the
      // Europeana client so e.g. 1850s candidates fail for the
      // Carthaginian general entity.
      const euObjs = await searchEuropeana(r.name, {
        limit: 3,
        entityDateStart: r.date_start,
        entityDateEnd: r.date_end,
      });
      const candidates: InsertSource[] = euObjs.map(fromEuropeana);
      if (candidates.length === 0) {
        console.log("—  no Europeana candidates");
        await sleep(150);
        continue;
      }

      let insertedThisEntity = 0;
      for (const c of candidates) {
        const result = await db
          .insert(media)
          .values({
            entityQid: r.qid,
            commonsUrl: c.url,
            kind: "image",
            license: c.license,
            attribution: c.attribution,
            caption: c.caption,
          })
          .onConflictDoNothing()
          .returning({ id: media.id });
        if (result.length > 0) insertedThisEntity += 1;
      }
      inserted += insertedThisEntity;
      if (insertedThisEntity > 0) entitiesWithHits += 1;

      console.log(
        `✓  eu=${euObjs.length}  +${insertedThisEntity} new`,
      );
    } catch (err) {
      failed += 1;
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(200);
  }

  console.log(
    `\n${inserted} new media rows · ${entitiesWithHits} entities with at least one hit · ${failed} failed`,
  );
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
