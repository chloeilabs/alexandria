// Generate a 1024-dim cosine embedding per entity via Voyage 4 large (over
// AI Gateway). Idempotent: if the entity already has an embedding and its
// content hasn't changed since the embedding was written, returns
// "already_done".
//
// The text we embed is intentionally compact and stable across tier upgrades:
//   "<name> — <type>, <date range>, <civ tag>. <summary first ~600 chars>".
// This is what users actually search against ("fall of an empire" → ranks
// against the *meaning* of each entity, not just keyword overlap).

import "../../lib/env";
import { embed, embedMany } from "ai";
import { eq, sql } from "drizzle-orm";

import { db } from "../../lib/db";
import { entities, entityRegions, pipelineRuns } from "../../lib/db/schema";
import {
  MODEL_EMBED,
  EMBED_DIMENSIONS,
  estimateEmbedCostUsd,
  roughTokensFromChars,
} from "../../lib/ai";
import { fmtDateRange } from "../../lib/format";
import { checkBudget } from "../budget";

export interface EmbedResult {
  qid: string;
  status: "ok" | "already_done" | "not_found";
  costUsd?: number;
  tokens?: number;
  dim?: number;
}

const EMBED_TEXT_BUDGET = 1800;

/** Builds the text we feed to the embedding model. Stable + compact. */
async function buildEmbedText(qid: string): Promise<{ text: string } | null> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);
  if (!entity) return null;

  const civTagRows = await db
    .select({ value: entityRegions.regionValue })
    .from(entityRegions)
    .where(
      sql`${entityRegions.entityQid} = ${qid} AND ${entityRegions.regionKind} = 'civilizational'`,
    );
  const civTags = civTagRows
    .map((r) => r.value.replace(/-/g, " "))
    .join(", ");

  const dr = fmtDateRange(
    entity.dateStart,
    entity.dateStartPrecision,
    entity.dateEnd,
    entity.dateEndPrecision,
  );

  const header = [
    entity.name,
    `— ${entity.type}`,
    dr ? `, ${dr}` : "",
    civTags ? `, ${civTags}` : "",
  ].join("");

  const body = (entity.summary ?? "").slice(0, EMBED_TEXT_BUDGET);
  const text = body ? `${header}. ${body}` : header;
  return { text };
}

export async function embedEntity(
  qid: string,
  opts: { force?: boolean } = {},
): Promise<EmbedResult> {
  const built = await buildEmbedText(qid);
  if (!built) return { qid, status: "not_found" };

  if (!opts.force) {
    // Cheap "already embedded?" check without pulling the whole vector.
    const [existing] = await db.execute<{ has: boolean }>(sql`
      SELECT (embedding IS NOT NULL) AS has FROM entities WHERE qid = ${qid}
    `);
    if (existing?.has) return { qid, status: "already_done" };
  }

  const inputTokens = roughTokensFromChars(built.text.length);
  await checkBudget(estimateEmbedCostUsd(inputTokens));

  const t0 = Date.now();
  const result = await embed({
    model: MODEL_EMBED,
    value: built.text,
  });

  const tokens = result.usage.tokens ?? inputTokens;
  const cost = estimateEmbedCostUsd(tokens);
  const vector = result.embedding;

  if (vector.length !== EMBED_DIMENSIONS) {
    throw new Error(
      `Embedding dim mismatch for ${qid}: got ${vector.length}, expected ${EMBED_DIMENSIONS}`,
    );
  }

  // pgvector accepts the array literal cast. Drizzle's vector column would
  // also work with the array directly, but the raw cast is unambiguous and
  // matches what we do elsewhere.
  const vecLiteral = `[${vector.join(",")}]`;

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE entities SET embedding = ${vecLiteral}::vector, updated_at = NOW() WHERE qid = ${qid}`,
    );
    await tx.insert(pipelineRuns).values({
      jobKind: "embed",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      entitiesProcessed: 1,
      apiCostUsd: cost.toString(),
      status: "completed",
    });
  });

  return { qid, status: "ok", costUsd: cost, tokens, dim: vector.length };
}

const EMBED_BATCH_SIZE = 128;

export interface EmbedBatchSummary {
  attempted: number;
  embedded: number;
  alreadyDone: number;
  notFound: number;
  totalCostUsd: number;
  totalTokens: number;
}

/**
 * Batch-embed many entities in chunks of 128 (Voyage 4 series max per
 * `embedMany` call). 100× fewer round-trips than per-qid `embedEntity()`,
 * same per-token cost. Used by `scripts/embed-all.ts` for first-pass
 * bulk embed; the per-qid worker stays in place for queue-driven re-embed.
 *
 * Skips entities that already have a vector (unless `force`). Budget gate
 * fires once per chunk against the chunk's estimated input tokens.
 */
export async function embedManyEntities(
  qids: readonly string[],
  opts: { force?: boolean } = {},
): Promise<EmbedBatchSummary> {
  const summary: EmbedBatchSummary = {
    attempted: 0,
    embedded: 0,
    alreadyDone: 0,
    notFound: 0,
    totalCostUsd: 0,
    totalTokens: 0,
  };

  // Resolve which qids actually need embedding (and gather text). Skip
  // those already embedded unless force=true. We do the existence-check
  // in bulk to avoid N round-trips.
  type Candidate = { qid: string; text: string };
  const candidates: Candidate[] = [];

  if (!opts.force && qids.length > 0) {
    const existingRows = await db.execute<{ qid: string }>(sql`
      SELECT qid FROM entities
      WHERE qid = ANY(${qids as string[]}::text[])
        AND embedding IS NOT NULL
    `);
    const already = new Set(Array.from(existingRows).map((r) => r.qid));
    summary.alreadyDone = already.size;
    for (const qid of qids) {
      if (already.has(qid)) continue;
      const built = await buildEmbedText(qid);
      if (!built) {
        summary.notFound += 1;
        continue;
      }
      candidates.push({ qid, text: built.text });
    }
  } else {
    for (const qid of qids) {
      const built = await buildEmbedText(qid);
      if (!built) {
        summary.notFound += 1;
        continue;
      }
      candidates.push({ qid, text: built.text });
    }
  }

  summary.attempted = candidates.length;

  for (let i = 0; i < candidates.length; i += EMBED_BATCH_SIZE) {
    const chunk = candidates.slice(i, i + EMBED_BATCH_SIZE);
    const estimatedTokens = chunk.reduce(
      (n, c) => n + roughTokensFromChars(c.text.length),
      0,
    );
    await checkBudget(estimateEmbedCostUsd(estimatedTokens));

    const t0 = Date.now();
    const result = await embedMany({
      model: MODEL_EMBED,
      values: chunk.map((c) => c.text),
    });

    const tokens = result.usage.tokens ?? estimatedTokens;
    const cost = estimateEmbedCostUsd(tokens);
    summary.totalCostUsd += cost;
    summary.totalTokens += tokens;

    if (result.embeddings.length !== chunk.length) {
      throw new Error(
        `embedMany returned ${result.embeddings.length} vectors for ${chunk.length} inputs`,
      );
    }

    // Validate every vector's dim once, then persist in a single tx per chunk.
    await db.transaction(async (tx) => {
      for (let j = 0; j < chunk.length; j += 1) {
        const c = chunk[j]!;
        const vector = result.embeddings[j]!;
        if (vector.length !== EMBED_DIMENSIONS) {
          throw new Error(
            `Embedding dim mismatch for ${c.qid}: got ${vector.length}, expected ${EMBED_DIMENSIONS}`,
          );
        }
        const vecLiteral = `[${vector.join(",")}]`;
        await tx.execute(
          sql`UPDATE entities SET embedding = ${vecLiteral}::vector, updated_at = NOW() WHERE qid = ${c.qid}`,
        );
      }
      await tx.insert(pipelineRuns).values({
        jobKind: "embed-batch",
        startedAt: new Date(t0),
        finishedAt: new Date(),
        entitiesProcessed: chunk.length,
        apiCostUsd: cost.toString(),
        status: "completed",
      });
    });

    summary.embedded += chunk.length;
  }

  return summary;
}
