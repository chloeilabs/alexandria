// Hybrid entity search.
//
// V1: Postgres full-text search via the generated `search_text` tsvector
// column (GIN-indexed). Ranks by ts_rank weighted by tier (curated content
// surfaces above stubs).
//
// V2 (deferred until embedding provider is chosen): add pgvector cosine
// similarity on the `embedding` column and combine via Reciprocal Rank
// Fusion. RRF formula: score = sum over ranked lists of 1/(k+rank), k=60.
// The structure here is intentionally written so the FTS path is a
// drop-in component of the eventual RRF.

import { sql } from "drizzle-orm";
import { db } from "../db";

export interface SearchHit {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  dateStartPrecision: string | null;
  dateEnd: number | null;
  dateEndPrecision: string | null;
  summary: string | null;
  rank: number;
}

type RawHit = {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  date_start: number | null;
  date_start_precision: string | null;
  date_end: number | null;
  date_end_precision: string | null;
  summary: string | null;
  rank: number;
} & Record<string, unknown>;

/**
 * Full-text search over name + summary, weighted by tier (curated content
 * surfaces above stubs).
 */
export async function searchByText(
  query: string,
  limit = 20,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // websearch_to_tsquery supports user-friendly syntax: quoted phrases,
  // OR keyword, leading "-" for negation. plainto_tsquery would be more
  // restrictive but also more predictable.
  const rows = await db.execute<RawHit>(sql`
    SELECT
      qid,
      slug,
      name,
      type,
      tier,
      date_start,
      date_start_precision,
      date_end,
      date_end_precision,
      summary,
      ts_rank(search_text, q) + (tier * 0.05) AS rank
    FROM entities, websearch_to_tsquery('english', ${trimmed}) q
    WHERE search_text @@ q
    ORDER BY rank DESC, tier DESC, name ASC
    LIMIT ${limit}
  `);

  return Array.from(rows).map((r) => ({
    qid: r.qid,
    slug: r.slug,
    name: r.name,
    type: r.type,
    tier: r.tier,
    dateStart: r.date_start,
    dateStartPrecision: r.date_start_precision,
    dateEnd: r.date_end,
    dateEndPrecision: r.date_end_precision,
    summary: r.summary,
    rank: r.rank,
  }));
}

/**
 * Reciprocal Rank Fusion of multiple ranked lists.
 * Reserved for when pgvector embeddings come online.
 */
export function rrf(
  lists: SearchHit[][],
  k = 60,
  limit = 20,
): SearchHit[] {
  const scores = new Map<string, { hit: SearchHit; score: number }>();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const prev = scores.get(hit.qid);
      const inc = 1 / (k + rank + 1);
      if (prev) prev.score += inc;
      else scores.set(hit.qid, { hit, score: inc });
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ hit, score }) => ({ ...hit, rank: score }));
}
