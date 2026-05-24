#!/usr/bin/env tsx
/**
 * Repair entities stuck because their Wikidata label differs from the
 * actual English Wikipedia article title.
 *
 * Background:
 *   `lib/wikipedia/index.ts:fetchSummary` and `fetchPlaintext` accept
 *   an optional `qid` that triggers a fallback to the Wikidata enwiki
 *   sitelink when the literal label (and its diacritic-stripped variant)
 *   both 404. Cases the diacritic strip can't handle:
 *     - "TutanKhamun" (typo in Wikidata extraction) → "Tutankhamun"
 *     - "Olmecas" (Wikidata returned Spanish label) → "Olmecs"
 *     - "Nzingha Mbande" → "Nzinga of Ndongo and Matamba"
 *     - "Geronimo" / "Gerónimo" → "Geronimo" (mostly the diacritic case)
 *
 *   The fix above means *future* enrich and fetch-media calls just work.
 *   But entities already stuck at Tier 0 with no source, or with no
 *   media row, need a backfill pass — that's this script.
 *
 * What it does:
 *   1. Finds entities at Tier 0 with no Wikipedia source row.
 *   2. Finds entities with no media row.
 *   3. For each, resolves the QID's enwiki sitelink and prints whether
 *      the literal label, diacritic-strip, or sitelink finally works.
 *   4. Calls summarizeEntity / fetch-media with the QID hint so the new
 *      fallback path picks up.
 *   5. Reports wins.
 *
 * Idempotent. ON CONFLICT DO NOTHING on the media insert; summarizeEntity
 * checks tier ≥ 1 to skip already-done.
 *
 * Usage:
 *   pnpm tsx scripts/repair-wikipedia-titles.ts                # dry-run all
 *   pnpm tsx scripts/repair-wikipedia-titles.ts --execute      # actually fix
 *   pnpm tsx scripts/repair-wikipedia-titles.ts --execute --limit=20
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities, media } from "../lib/db/schema";
import { fetchSummary, resolveWikipediaTitle } from "../lib/wikipedia";
import { stripDiacritics } from "../lib/format";
import { summarizeEntity } from "../pipeline/workers/summarize";
import { BudgetExceeded } from "../pipeline/budget";

interface Args {
  execute: boolean;
  rename: boolean;
  limit: number | null;
}

function parseArgs(argv: readonly string[]): Args {
  const out: Args = { execute: false, rename: false, limit: null };
  for (const a of argv) {
    if (a === "--execute") out.execute = true;
    else if (a === "--rename") out.rename = true;
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) out.limit = n;
    }
  }
  return out;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    args.execute
      ? "Repair mode: --execute (will write fixes)\n"
      : "Dry-run mode (no writes; pass --execute to apply)\n",
  );

  // ----- Find candidates -----
  // (1) Tier 0 with no wikipedia source row — enrichment failed.
  // (2) Any tier with no media row — hero imagery failed.
  // We dedupe across both.

  const stuckEnrich = await db.execute<{ qid: string; name: string }>(sql`
    SELECT e.qid, e.name
    FROM entities e
    WHERE e.tier = 0
      AND NOT EXISTS (
        SELECT 1 FROM sources s
        WHERE s.entity_qid = e.qid AND s.source_kind = 'wikipedia'
      )
    ORDER BY e.inbound_link_count DESC, e.qid ASC
    LIMIT ${args.limit ?? 500}
  `);

  const stuckMedia = await db.execute<{ qid: string; name: string }>(sql`
    SELECT e.qid, e.name
    FROM entities e
    WHERE NOT EXISTS (
      SELECT 1 FROM media m WHERE m.entity_qid = e.qid
    )
    ORDER BY e.tier DESC, e.inbound_link_count DESC, e.qid ASC
    LIMIT ${args.limit ?? 500}
  `);

  const candidates = new Map<string, { qid: string; name: string; needs: Set<"enrich" | "media"> }>();
  for (const r of stuckEnrich) {
    if (!candidates.has(r.qid)) candidates.set(r.qid, { qid: r.qid, name: r.name, needs: new Set() });
    candidates.get(r.qid)!.needs.add("enrich");
  }
  for (const r of stuckMedia) {
    if (!candidates.has(r.qid)) candidates.set(r.qid, { qid: r.qid, name: r.name, needs: new Set() });
    candidates.get(r.qid)!.needs.add("media");
  }

  console.log(
    `${stuckEnrich.length} need enrich  ·  ${stuckMedia.length} need media  ·  ${candidates.size} unique entities to try.\n`,
  );

  // ----- Diagnose each candidate -----
  let sitelinkDiverges = 0;
  let enrichFixed = 0;
  let mediaFixed = 0;
  let stillStuck = 0;
  let failed = 0;

  const list = Array.from(candidates.values()).slice(0, args.limit ?? 500);

  for (const c of list) {
    const sitelink = await resolveWikipediaTitle(c.qid);
    const stripped = stripDiacritics(c.name);
    const labels: string[] = [];
    if (sitelink && sitelink !== c.name) {
      sitelinkDiverges += 1;
      labels.push(`sitelink="${sitelink}"`);
    }
    if (stripped !== c.name) labels.push(`stripped="${stripped}"`);
    const tag = labels.length > 0 ? "  (" + labels.join(", ") + ")" : "";

    process.stdout.write(`  ${c.qid.padEnd(10)} ${c.name.slice(0, 30).padEnd(30)} ${[...c.needs].join("+").padEnd(13)}${tag}\n`);

    if (!args.execute) {
      await sleep(120);
      continue;
    }

    // ----- Execute path -----
    let touched = false;
    try {
      if (c.needs.has("enrich")) {
        const r = await summarizeEntity(c.qid);
        if (r.status === "ok") {
          enrichFixed += 1;
          touched = true;
          console.log(`    ✓ enriched`);
        } else if (r.status === "no_source") {
          console.log(`    — enrich still no_source (sitelink "${sitelink ?? "(none)"}" didn't help)`);
        } else {
          console.log(`    — enrich ${r.status}`);
        }
      }
      if (c.needs.has("media")) {
        const summary = await fetchSummary(c.name, { qid: c.qid });
        if (summary?.originalUrl) {
          // .returning() so we can tell whether ON CONFLICT silently
          // dropped the row (some entities resolve to a Commons URL
          // already in use — e.g. Luba and Kuba both share Lunda_Empire.png).
          const inserted = await db
            .insert(media)
            .values({
              entityQid: c.qid,
              commonsUrl: summary.originalUrl,
              kind: "image",
              license: "see Wikimedia Commons",
              attribution: `Wikimedia Commons · ${summary.title}`,
            })
            .onConflictDoNothing()
            .returning({ id: media.id });
          const dim =
            summary.originalWidth && summary.originalHeight
              ? `${summary.originalWidth}×${summary.originalHeight}`
              : "?";
          if (inserted.length > 0) {
            mediaFixed += 1;
            touched = true;
            console.log(`    ✓ media  ${dim}`);
          } else {
            console.log(`    · media url already used by another entity (skipped)`);
          }
        } else {
          console.log(`    — media still no_image`);
        }
      }
      if (args.rename && sitelink && sitelink !== c.name && !sitelink.includes(" (")) {
        await db
          .update(entities)
          .set({ name: sitelink })
          .where(eq(entities.qid, c.qid));
        console.log(`    ✓ renamed "${c.name}" → "${sitelink}"`);
        touched = true;
      }
      if (!touched) stillStuck += 1;
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        console.log(`    ✗ BUDGET EXCEEDED — stopping`);
        break;
      }
      failed += 1;
      console.log(`    ✗ ${err instanceof Error ? err.message : String(err)}`);
    }
    // Wikidata + Wikipedia REST tolerate this rate fine; the User-Agent
    // we send is descriptive so they can find us if we go over.
    await sleep(180);
  }

  // ----- Summary -----
  console.log("");
  console.log(`Diagnosed:   ${list.length}`);
  console.log(`  sitelink diverges from name on ${sitelinkDiverges}`);
  if (args.execute) {
    console.log(`Results:`);
    console.log(`  enriched: ${enrichFixed}`);
    console.log(`  media:    ${mediaFixed}`);
    console.log(`  stuck:    ${stillStuck} (sitelink lookup didn't recover them)`);
    console.log(`  failed:   ${failed}`);
  } else {
    console.log(`(re-run with --execute to actually apply fixes)`);
  }

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
