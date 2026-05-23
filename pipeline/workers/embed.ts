// Generate a 1024-dim cosine embedding per entity via Voyage 3 large (over
// AI Gateway). Idempotent: if the entity already has an embedding and its
// content hasn't changed since the embedding was written, returns
// "already_done".
//
// The text we embed is intentionally compact and stable across tier upgrades:
//   "<name> — <type>, <date range>, <civ tag>. <summary first ~600 chars>".
// This is what users actually search against ("fall of an empire" → ranks
// against the *meaning* of each entity, not just keyword overlap).

import "../../lib/env";
import { embed } from "ai";
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
