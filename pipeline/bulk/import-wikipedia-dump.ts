#!/usr/bin/env tsx
/**
 * Stream-import the English Wikipedia XML dump and match articles
 * to Wikidata QIDs in our bulk entity table.
 *
 * Usage:
 *   pnpm pipeline:wikipedia
 *   pnpm pipeline:wikipedia -- --limit=10000           # test on first N matches
 *   pnpm pipeline:wikipedia -- --dump-path=...         # override env path
 *   pnpm pipeline:wikipedia -- --stdin                 # curl-pipe the bz2
 *   pnpm pipeline:wikipedia -- --fresh                 # ignore checkpoint
 *
 * The dump is `enwiki-latest-pages-articles-multistream.xml.bz2` (~22GB).
 * We stream it via `unbzip2-stream` and parse incrementally with sax —
 * never decompress to disk, never hold the whole file in memory.
 *
 * Strategy:
 *   1. On startup, build an in-memory Map<normalizedTitle, qid> from
 *      the local entities table (name + aliases). Around 230K entries
 *      at ~50 bytes each → ~12MB RAM.
 *   2. Stream the XML. For each <page> element, extract title + text.
 *      Skip non-article namespaces (ns != 0) and redirect pages.
 *   3. Normalize the title (lowercase + underscore_or_space normalize).
 *      If it matches the map, insert into `sources` as the wikipedia
 *      source for that QID. ON CONFLICT DO NOTHING — re-runs are safe.
 *   4. Checkpoint every 10K matches.
 *
 * The wikitext is stored raw. Downstream narrate/summarize workers will
 * already clean it — and the AI is robust enough to read raw wikitext.
 *
 * Importantly, this writes to the LOCAL bulk DB (Docker Postgres). It
 * doesn't ship to Neon — that happens later when a specific entity is
 * promoted via scripts/promote-from-bulk.ts.
 */
import "../../lib/env";
import fs from "node:fs";
// @ts-expect-error — unbzip2-stream has no types
import unbzip2Stream from "unbzip2-stream";
import sax from "sax";
import { sql } from "drizzle-orm";

import { db } from "../../lib/db";
import {
  entityAliases,
  pipelineCheckpoints,
  pipelineRuns,
  sources,
} from "../../lib/db/schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DUMP_PATH_DEFAULT =
  process.env.WIKIPEDIA_DUMP_PATH ??
  "./dumps/enwiki-latest-pages-articles-multistream.xml.bz2";

const BATCH_SIZE = 200;
const CHECKPOINT_EVERY = 10_000;
const CHECKPOINT_KIND = "wikipedia_dump";
const PROGRESS_EVERY = 100_000;
const LICENSE = "CC BY-SA 4.0";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  dumpPath: string;
  limit: number | null;
  fresh: boolean;
  stdin: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const out: Args = {
    dumpPath: DUMP_PATH_DEFAULT,
    limit: null,
    fresh: false,
    stdin: false,
  };
  for (const a of argv) {
    if (a.startsWith("--dump-path=")) {
      out.dumpPath = a.slice("--dump-path=".length);
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) out.limit = n;
    } else if (a === "--fresh") {
      out.fresh = true;
    } else if (a === "--stdin") {
      out.stdin = true;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Title normalization — must be deterministic across map-build + match.
// ---------------------------------------------------------------------------

function normTitle(s: string): string {
  // MediaWiki canonicalization: first char uppercase, _ ↔ space equivalent,
  // case-insensitive on the rest. We lowercase everything for the lookup map.
  return s.replace(/_/g, " ").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Build the title → qid lookup map.
//
// Precision matters more than recall here. The Wikidata dump in our local
// DB has plenty of name collisions (29 places called "Buenavista", 14
// "Buenos Aires"es, 9 "Symphony No. 3"s) and an "Alexander the Great"
// labelled as a work, separate from the real person Q8409. If we mapped
// a collision-prone title to the *first* QID that claimed it, we'd
// systematically attach Wikipedia article text to the wrong entity.
//
// So we use only **unambiguous** mappings:
//   - Primary entity names that appear exactly once in the corpus.
//   - No aliases (too noisy: aliases like "Alexander the Great" map to
//     fan-fic works, films, ship names, etc.).
//
// The structural fix is to capture sitelinks.enwiki.title during the
// Wikidata import — that gives a 1:1 mapping. This matcher is a stopgap
// until the bulk import is re-run with that column populated.
// ---------------------------------------------------------------------------

interface TitleMap {
  map: Map<string, string>;
  totalNames: number;
  uniqueNames: number;
  collidingNames: number;
}

async function buildTitleMap(): Promise<TitleMap> {
  console.log(
    "Loading title → QID map from bulk entities (unique names only)…",
  );
  const t0 = Date.now();

  // One pass to find names with COUNT(*) = 1 — true unique titles.
  const rows = await db.execute<{ qid: string; name: string }>(sql`
    WITH counts AS (
      SELECT LOWER(name) AS lname, COUNT(*) AS c
      FROM entities
      GROUP BY LOWER(name)
    )
    SELECT e.qid, e.name
    FROM entities e
    JOIN counts c ON c.lname = LOWER(e.name)
    WHERE c.c = 1
  `);

  const map = new Map<string, string>();
  for (const r of rows) map.set(normTitle(r.name), r.qid);

  // Total + collision telemetry, purely informational.
  const [{ total }] = (await db.execute<{ total: number }>(sql`
    SELECT COUNT(*)::int AS total FROM entities
  `)) as unknown as [{ total: number }];

  const collidingNames = total - rows.length;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `Loaded ${rows.length.toLocaleString()} unique-name → QID mappings ` +
      `(${collidingNames.toLocaleString()} colliding-name entities skipped) in ${secs}s.`,
  );

  return {
    map,
    totalNames: total,
    uniqueNames: rows.length,
    collidingNames,
  };
}

// Reference (silences unused-import lint when we drop the alias query).
void entityAliases;

// ---------------------------------------------------------------------------
// Batch insert into sources
// ---------------------------------------------------------------------------

type SourceRow = typeof sources.$inferInsert;

async function flush(batch: SourceRow[]): Promise<void> {
  if (batch.length === 0) return;
  await db
    .insert(sources)
    .values(batch)
    .onConflictDoNothing({
      target: [sources.entityQid, sources.sourceKind],
    });
}

// ---------------------------------------------------------------------------
// Main stream loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.stdin && !fs.existsSync(args.dumpPath)) {
    console.error(`Dump file not found: ${args.dumpPath}`);
    console.error(
      "Download: https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles-multistream.xml.bz2",
    );
    console.error("Or pass --dump-path=<path> or --stdin");
    process.exit(1);
  }

  const titleMap = await buildTitleMap();

  // Prior checkpoint, telemetry only — bz2 isn't seekable.
  const priorCheckpoint = args.fresh
    ? null
    : (
        await db
          .select()
          .from(pipelineCheckpoints)
          .where(sql`${pipelineCheckpoints.kind} = ${CHECKPOINT_KIND}`)
          .limit(1)
      )[0] ?? null;
  if (priorCheckpoint) {
    console.log(
      `Prior checkpoint: ${priorCheckpoint.entitiesCount} articles matched at ${priorCheckpoint.lastProcessedQid}. Re-streams from line 1 (idempotent via ON CONFLICT).`,
    );
  }

  const [run] = await db
    .insert(pipelineRuns)
    .values({ jobKind: CHECKPOINT_KIND, status: "running" })
    .returning({ id: pipelineRuns.id });
  const runId = run!.id;
  console.log(`Pipeline run #${runId} started.`);

  const t0 = Date.now();
  let pagesSeen = 0;
  let articlesSeen = 0;
  let matched = 0;
  let lastQid: string | null = null;
  let batch: SourceRow[] = [];
  let done = false;
  let earlyExitTrigger: (() => void) | null = null;

  const fileStream = args.stdin
    ? process.stdin
    : fs.createReadStream(args.dumpPath);
  if (args.stdin) console.log("Reading bz2 from stdin (curl-pipe mode).");

  // sax in strict mode would reject the Wikipedia XML's mixed content;
  // permissive mode handles it fine.
  const parser = sax.createStream(false, {
    trim: false,
    normalize: false,
    lowercase: true,
  });

  // Per-page state. The Wikipedia dump uses <page><title>…</title><ns>0</ns>
  // <redirect/>?<revision><text>…</text></revision></page>.
  let inPage = false;
  let currentTag: string | null = null;
  let pageTitle = "";
  let pageNs: string | null = null;
  let pageText = "";
  let isRedirect = false;

  // Used by the sax stream to pause flow control while we await a batch flush.
  let pendingFlush: Promise<void> | null = null;

  function resetPage() {
    pageTitle = "";
    pageNs = null;
    pageText = "";
    isRedirect = false;
  }

  parser.on("opentag", (tag) => {
    currentTag = tag.name;
    if (tag.name === "page") {
      inPage = true;
      resetPage();
    } else if (tag.name === "redirect" && inPage) {
      isRedirect = true;
    }
  });

  parser.on("text", (text) => {
    if (!inPage || !currentTag) return;
    // Accumulate the value of the tag we're inside of.
    if (currentTag === "title") pageTitle += text;
    else if (currentTag === "ns") pageNs = (pageNs ?? "") + text;
    else if (currentTag === "text") pageText += text;
  });

  parser.on("closetag", (tagName) => {
    if (tagName === "page" && inPage) {
      inPage = false;
      pagesSeen += 1;

      // Main-namespace, non-redirect only.
      const ns = (pageNs ?? "").trim();
      if (ns === "0" && !isRedirect) {
        articlesSeen += 1;
        const norm = normTitle(pageTitle);
        const qid = titleMap.map.get(norm);
        if (qid) {
          matched += 1;
          lastQid = qid;
          batch.push({
            entityQid: qid,
            sourceKind: "wikipedia",
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`,
            content: pageText,
            license: LICENSE,
          });
          if (batch.length >= BATCH_SIZE) {
            const toFlush = batch;
            batch = [];
            // Pause the stream while we flush, to keep memory bounded.
            parser.pause();
            pendingFlush = flush(toFlush).then(() => {
              parser.resume();
              pendingFlush = null;
            });
          }
        }
      }

      if (pagesSeen % PROGRESS_EVERY === 0) {
        const secs = (Date.now() - t0) / 1000;
        const rate = (pagesSeen / secs).toFixed(0);
        console.log(
          `  pages=${pagesSeen.toLocaleString()}  articles=${articlesSeen.toLocaleString()}  matched=${matched.toLocaleString()}  rate=${rate} pages/s  last=${lastQid ?? "—"}`,
        );
      }

      if (matched > 0 && matched % CHECKPOINT_EVERY === 0) {
        parser.pause();
        pendingFlush = checkpoint().then(() => {
          parser.resume();
          pendingFlush = null;
        });
      }

      if (args.limit && matched >= args.limit && !done) {
        done = true;
        console.log(`Reached --limit=${args.limit}; stopping.`);
        // Signal the outer await loop; it'll destroy the source stream
        // after this handler returns, so we don't choke sax mid-document.
        earlyExitTrigger?.();
      }
    }
    currentTag = null;
  });

  async function checkpoint(): Promise<void> {
    await db
      .insert(pipelineCheckpoints)
      .values({
        kind: CHECKPOINT_KIND,
        lastProcessedQid: lastQid,
        byteOffset: BigInt(pagesSeen),
        entitiesCount: matched,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pipelineCheckpoints.kind,
        set: {
          lastProcessedQid: lastQid,
          byteOffset: BigInt(pagesSeen),
          entitiesCount: matched,
          updatedAt: new Date(),
        },
      });
  }

  async function finishRun(
    status: "completed" | "failed",
    errorMessage?: string,
  ): Promise<void> {
    await db
      .update(pipelineRuns)
      .set({
        finishedAt: new Date(),
        entitiesProcessed: matched,
        status,
        errorMessage: errorMessage ?? null,
      })
      .where(sql`${pipelineRuns.id} = ${runId}`);
  }

  process.on("SIGINT", async () => {
    console.log("\nSIGINT — flushing batch and writing checkpoint…");
    try {
      if (pendingFlush) await pendingFlush;
      await flush(batch);
      await checkpoint();
      await finishRun("failed", "Interrupted by SIGINT");
    } catch (e) {
      console.error("Error during shutdown:", e);
    } finally {
      process.exit(130);
    }
  });

  try {
    // Pipe bz2 → decompressor → sax stream. Await stream end (or our
    // own early-exit signal when --limit is reached).
    let earlyExitResolve: (() => void) | null = null;
    const earlyExit = new Promise<void>((resolve) => {
      earlyExitResolve = resolve;
    });
    earlyExitTrigger = () => {
      if (earlyExitResolve) {
        earlyExitResolve();
        earlyExitResolve = null;
      }
    };
    const streamDone = new Promise<void>((resolve, reject) => {
      parser.on("end", () => resolve());
      parser.on("error", (err) => reject(err));
      fileStream.on("error", (err) => reject(err));
      fileStream.pipe(unbzip2Stream()).pipe(parser);
    });
    await Promise.race([streamDone, earlyExit]);
    // If we exited early, stop consuming the source.
    if (done) fileStream.destroy();

    if (pendingFlush) await pendingFlush;
    await flush(batch);
    await checkpoint();
    await finishRun("completed");

    const secs = (Date.now() - t0) / 1000;
    console.log("\n— Wikipedia matcher complete —");
    console.log(`  pages read:       ${pagesSeen.toLocaleString()}`);
    console.log(`  articles (ns=0):  ${articlesSeen.toLocaleString()}`);
    console.log(`  matched to QID:   ${matched.toLocaleString()}`);
    console.log(`  hit rate:         ${(matched / Math.max(articlesSeen, 1) * 100).toFixed(2)}%`);
    console.log(`  duration:         ${secs.toFixed(1)} s`);
    console.log(`  effective rate:   ${(pagesSeen / secs).toFixed(0)} pages/s`);
  } catch (err) {
    console.error("Fatal error during streaming:", err);
    try {
      if (pendingFlush) await pendingFlush;
      await flush(batch);
      await checkpoint();
      await finishRun("failed", err instanceof Error ? err.message : String(err));
    } catch (innerErr) {
      console.error("Error during failure-shutdown:", innerErr);
    }
    process.exit(1);
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
