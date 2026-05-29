// Hybrid search: FTS + pgvector via Reciprocal Rank Fusion (k=60).
//
// The two rankings each rank the full candidate list independently, then
// RRF combines them: score(d) = sum_i 1/(k + rank_i(d)). This is robust
// to ranker-specific score-scale differences and well-studied for hybrid
// IR.

import { sql } from "drizzle-orm";

import { db } from "..";
import { withRetry } from "../retry";
import { embed } from "@/lib/ai/gateway";
import type { EntityType } from "../schema";
import type { EntityStub } from "./entity";

const RRF_K = 60;
const CANDIDATE_LIMIT = 60;

// Typeahead suggestions: cheap, typo-tolerant match on names + aliases.
// No embedding call — safe to hit on every keystroke. Three signals,
// ranked in this order:
//   1. prefix match on the name        ("newt" → Newton)
//   2. substring match on name/alias   ("evolution" → ...Revolution; alias "WW2")
//   3. trigram word-similarity         ("einstien" → Einstein) — typo tolerance
// pg_trgm's word_similarity finds the best-matching WORD inside the name, so
// a misspelling matches even when buried in a multi-word title. Seq-scan over
// the corpus is fine at this scale; the trigram GIN indexes remain available
// if it grows large enough to need the `<%` operator.
const FUZZY_THRESHOLD = 0.4;

export async function suggestEntities(
  query: string,
  limit = 8,
): Promise<EntityStub[]> {
  // Strip LIKE wildcards so user input is matched literally.
  const q = query.trim().replace(/[%_\\]/g, " ").trim();
  if (q.length < 2) return [];
  const prefix = `${q}%`;
  const contains = `%${q}%`;

  return await withRetry("suggestEntities", async () => {
    const rows = await db.execute<{
      id: string;
      slug: string;
      canonical_name: string;
      entity_type: string;
      short_description: string;
      consensus_score: number;
    }>(sql`
      SELECT e.id, e.slug, e.canonical_name, e.entity_type,
             e.short_description, e.consensus_score
      FROM entities e
      LEFT JOIN entity_aliases a ON a.entity_id = e.id
      WHERE e.status = 'published'
      GROUP BY e.id
      HAVING bool_or(e.canonical_name ILIKE ${contains} OR a.alias ILIKE ${contains})
          OR GREATEST(
               word_similarity(${q}, e.canonical_name),
               COALESCE(MAX(word_similarity(${q}, a.alias)), 0)
             ) > ${FUZZY_THRESHOLD}
      ORDER BY
        bool_or(e.canonical_name ILIKE ${prefix}) DESC,
        bool_or(e.canonical_name ILIKE ${contains} OR a.alias ILIKE ${contains}) DESC,
        GREATEST(
          word_similarity(${q}, e.canonical_name),
          COALESCE(MAX(word_similarity(${q}, a.alias)), 0)
        ) DESC,
        length(e.canonical_name) ASC,
        e.consensus_score DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      canonicalName: r.canonical_name,
      entityType: r.entity_type,
      shortDescription: r.short_description,
      consensusScore: r.consensus_score,
    }));
  });
}

export async function hybridSearch(args: {
  query: string;
  entityType?: EntityType;
  limit: number;
}): Promise<EntityStub[]> {
  const { embedding } = await embed(args.query);
  const vec = `[${embedding.join(",")}]`;
  const typeFilter = args.entityType ?? null;

  return await withRetry("hybridSearch", async () => {
    const rows = await db.execute<{
      id: string;
      slug: string;
      canonical_name: string;
      entity_type: string;
      short_description: string;
      consensus_score: number;
      rrf_score: number;
    }>(sql`
      WITH fts AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 ORDER BY ts_rank_cd(search_text, plainto_tsquery('english', ${args.query})) DESC
               ) AS rank
        FROM entities
        WHERE status = 'published'
          AND search_text @@ plainto_tsquery('english', ${args.query})
          AND (${typeFilter}::text IS NULL OR entity_type = ${typeFilter})
        ORDER BY rank
        LIMIT ${CANDIDATE_LIMIT}
      ),
      vec AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY embedding <=> ${vec}::vector) AS rank
        FROM entities
        WHERE status = 'published'
          AND embedding IS NOT NULL
          AND (${typeFilter}::text IS NULL OR entity_type = ${typeFilter})
        ORDER BY embedding <=> ${vec}::vector
        LIMIT ${CANDIDATE_LIMIT}
      ),
      fused AS (
        SELECT id,
               SUM(score) AS rrf_score
        FROM (
          SELECT id, 1.0 / (${RRF_K} + rank) AS score FROM fts
          UNION ALL
          SELECT id, 1.0 / (${RRF_K} + rank) AS score FROM vec
        ) parts
        GROUP BY id
      )
      SELECT e.id, e.slug, e.canonical_name, e.entity_type,
             e.short_description, e.consensus_score,
             f.rrf_score
      FROM fused f
      JOIN entities e ON e.id = f.id
      ORDER BY f.rrf_score DESC
      LIMIT ${args.limit}
    `);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      canonicalName: r.canonical_name,
      entityType: r.entity_type,
      shortDescription: r.short_description,
      consensusScore: r.consensus_score,
    }));
  });
}
