#!/usr/bin/env tsx
/**
 * Stream-import the Wikidata JSON dump into our Tier 0 entities table.
 *
 * Usage:
 *   pnpm pipeline:wikidata
 *   pnpm pipeline:wikidata -- --limit=10000     # test on N entities
 *   pnpm pipeline:wikidata -- --dump-path=...   # override env path
 *   pnpm pipeline:wikidata -- --fresh           # ignore checkpoint
 *
 * The dump is the multistream JSON file `latest-all.json.bz2` (~80 GB).
 * We stream it directly via `unbzip2-stream` — never decompress to disk.
 *
 * On crash, restart resumes by re-streaming from line 1; ON CONFLICT DO
 * NOTHING upserts make re-inserts cheap. The checkpoint table tracks
 * progress purely for telemetry, not for skip-ahead (bz2 is not seekable).
 */
import "../../lib/env";
import fs from "node:fs";
import readline from "node:readline";
// @ts-expect-error — unbzip2-stream has no types
import unbzip2Stream from "unbzip2-stream";
import { sql } from "drizzle-orm";

import { db } from "../../lib/db";
import {
  entities,
  entityAliases,
  pipelineCheckpoints,
  pipelineRuns,
  relationships,
} from "../../lib/db/schema";
import type { WdEntity } from "./wikidata";
import {
  getAliases,
  getCoordinates,
  getDates,
  getName,
  getRelationships,
  makeSlug,
  passesSeedFilter,
} from "./wikidata";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DUMP_PATH_DEFAULT =
  process.env.WIKIDATA_DUMP_PATH ?? "./dumps/latest-all.json.bz2";

const BATCH_SIZE = 500;
const CHECKPOINT_EVERY = 10_000;
const CHECKPOINT_KIND = "wikidata_dump";
const PROGRESS_EVERY = 50_000;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  dumpPath: string;
  limit: number | null;
  fresh: boolean;
  /** When true, read bz2 from process.stdin instead of a file. Used to
   *  curl-pipe the dump straight from the network without ever landing
   *  the 100GB file on disk. */
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
    } else if (a === "--sample-only") {
      out.limit = 10_000;
    } else if (a === "--fresh") {
      out.fresh = true;
    } else if (a === "--stdin") {
      out.stdin = true;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Batch buffers + flush
// ---------------------------------------------------------------------------

type EntityRow = typeof entities.$inferInsert;
type AliasRow = typeof entityAliases.$inferInsert;
type RelRow = typeof relationships.$inferInsert;

interface Batch {
  entities: EntityRow[];
  aliases: AliasRow[];
  relationships: RelRow[];
}

function emptyBatch(): Batch {
  return { entities: [], aliases: [], relationships: [] };
}

async function flush(batch: Batch): Promise<void> {
  if (batch.entities.length === 0) return;

  await db.transaction(async (tx) => {
    // Entities first — relationships.source_qid FK depends on them.
    await tx
      .insert(entities)
      .values(batch.entities)
      .onConflictDoNothing({ target: entities.qid });

    if (batch.aliases.length > 0) {
      // Insert aliases in chunks of 1000 to keep parameter count reasonable.
      for (let i = 0; i < batch.aliases.length; i += 1000) {
        await tx
          .insert(entityAliases)
          .values(batch.aliases.slice(i, i + 1000))
          .onConflictDoNothing();
      }
    }

    if (batch.relationships.length > 0) {
      for (let i = 0; i < batch.relationships.length; i += 1000) {
        await tx
          .insert(relationships)
          .values(batch.relationships.slice(i, i + 1000))
          .onConflictDoNothing();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Main streaming loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.stdin && !fs.existsSync(args.dumpPath)) {
    console.error(`Dump file not found: ${args.dumpPath}`);
    console.error(
      "Download: https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2",
    );
    console.error("Or pass --dump-path=<path> or --stdin");
    process.exit(1);
  }

  // Read prior checkpoint for telemetry (we don't skip-ahead — bz2 isn't
  // seekable — but we report progress relative to it).
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
      `Prior checkpoint: ${priorCheckpoint.entitiesCount} entities at ${priorCheckpoint.lastProcessedQid}. Resuming will re-stream from line 1 (idempotent via ON CONFLICT).`,
    );
  }

  // Open a pipeline_runs row
  const [run] = await db
    .insert(pipelineRuns)
    .values({
      jobKind: CHECKPOINT_KIND,
      status: "running",
    })
    .returning({ id: pipelineRuns.id });
  const runId = run!.id;
  console.log(`Pipeline run #${runId} started.`);

  const t0 = Date.now();
  let linesRead = 0;
  let entitiesAccepted = 0;
  let entitiesRejected = 0;
  let lastQid: string | null = null;
  let batch = emptyBatch();

  const fileStream = args.stdin
    ? process.stdin
    : fs.createReadStream(args.dumpPath);
  if (args.stdin) {
    console.log("Reading bz2 from stdin (curl-pipe mode).");
  }
  const decompressed = fileStream.pipe(unbzip2Stream());
  const rl = readline.createInterface({
    input: decompressed,
    crlfDelay: Infinity,
  });

  async function checkpoint(): Promise<void> {
    await db
      .insert(pipelineCheckpoints)
      .values({
        kind: CHECKPOINT_KIND,
        lastProcessedQid: lastQid,
        byteOffset: BigInt(linesRead),
        entitiesCount: entitiesAccepted,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pipelineCheckpoints.kind,
        set: {
          lastProcessedQid: lastQid,
          byteOffset: BigInt(linesRead),
          entitiesCount: entitiesAccepted,
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
        entitiesProcessed: entitiesAccepted,
        status,
        errorMessage: errorMessage ?? null,
      })
      .where(sql`${pipelineRuns.id} = ${runId}`);
  }

  process.on("SIGINT", async () => {
    console.log("\nSIGINT — flushing batch and writing checkpoint…");
    try {
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
    for await (const rawLine of rl) {
      linesRead += 1;

      // Strip trailing comma from dump-array formatting.
      let line = rawLine;
      if (line.endsWith(",")) line = line.slice(0, -1);
      if (line === "[" || line === "]" || line.length === 0) continue;

      let entity: WdEntity;
      try {
        entity = JSON.parse(line) as WdEntity;
      } catch {
        continue; // malformed line — skip
      }

      const type = passesSeedFilter(entity);
      if (!type) {
        entitiesRejected += 1;
      } else {
        const name = getName(entity.labels);
        if (!name) {
          entitiesRejected += 1;
        } else {
          const dates = getDates(entity.claims, type);
          const coords = getCoordinates(entity.claims);
          const aliases = getAliases(entity.labels, entity.aliases, name);
          const rels = getRelationships(entity.claims, entity.id);

          batch.entities.push({
            qid: entity.id,
            slug: makeSlug(name, entity.id),
            name,
            type,
            tier: 0,
            dateStart: dates.dateStart,
            dateStartPrecision: dates.dateStartPrecision,
            dateEnd: dates.dateEnd,
            dateEndPrecision: dates.dateEndPrecision,
            latitude: coords?.latitude ?? null,
            longitude: coords?.longitude ?? null,
          });

          for (const a of aliases) {
            batch.aliases.push({
              entityQid: entity.id,
              alias: a.alias,
              language: a.language,
            });
          }
          for (const r of rels) {
            batch.relationships.push({
              sourceQid: r.sourceQid,
              targetQid: r.targetQid,
              predicate: r.predicate,
              qualifiers: r.qualifiers,
            });
          }

          entitiesAccepted += 1;
          lastQid = entity.id;
        }
      }

      if (batch.entities.length >= BATCH_SIZE) {
        await flush(batch);
        batch = emptyBatch();
      }
      if (entitiesAccepted > 0 && entitiesAccepted % CHECKPOINT_EVERY === 0) {
        await checkpoint();
      }
      if (linesRead % PROGRESS_EVERY === 0) {
        const secs = (Date.now() - t0) / 1000;
        const rate = (entitiesAccepted / secs).toFixed(1);
        console.log(
          `  lines=${linesRead.toLocaleString()}  accepted=${entitiesAccepted.toLocaleString()}  rejected=${entitiesRejected.toLocaleString()}  rate=${rate}/s  last=${lastQid ?? "—"}`,
        );
      }

      if (args.limit && entitiesAccepted >= args.limit) {
        console.log(`Reached --limit=${args.limit}; stopping.`);
        break;
      }
    }

    await flush(batch);
    await checkpoint();
    await finishRun("completed");

    const secs = (Date.now() - t0) / 1000;
    console.log("\n— Wikidata seed complete —");
    console.log(`  lines read:        ${linesRead.toLocaleString()}`);
    console.log(`  entities accepted: ${entitiesAccepted.toLocaleString()}`);
    console.log(`  entities rejected: ${entitiesRejected.toLocaleString()}`);
    console.log(`  duration:          ${secs.toFixed(1)} s`);
    console.log(
      `  effective rate:    ${(entitiesAccepted / secs).toFixed(1)} entities/s`,
    );
  } catch (err) {
    console.error("Fatal error during streaming:", err);
    try {
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
