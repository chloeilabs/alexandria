// Hybrid entity search: FTS (keyword) + pgvector (semantic) fused with RRF.
//
// FTS: Postgres `to_tsvector` over name + summary, GIN-indexed, ranked
// via ts_rank with a tier bonus so curated content surfaces above stubs.
// ts_headline produces highlighted snippets.
//
// Vector: Voyage 3 large 1024-dim embeddings stored on entities.embedding,
// cosine-distance via pgvector's `<=>` operator. HNSW-indexed.
//
// Fusion: Reciprocal Rank Fusion (k=60, RRF paper standard). Robust to
// scale differences between FTS and cosine — we never mix raw scores.
//
// Facets: optional `type` and `era` filters. Era buckets are derived from
// date_start.

import { sql } from "drizzle-orm";
import { embed } from "ai";

import { db } from "../db";
import { withRetry } from "../db/retry";
import { MODEL_EMBED } from "../ai";

export const ENTITY_TYPES = [
  "person",
  "place",
  "event",
  "organization",
  "work",
  "concept",
] as const;
export type EntityTypeFilter = (typeof ENTITY_TYPES)[number];

export const ERAS = [
  { id: "ancient", label: "Ancient", min: -10_000, max: -1000 },
  { id: "classical", label: "Classical", min: -1000, max: 500 },
  { id: "medieval", label: "Medieval", min: 500, max: 1500 },
  { id: "early-modern", label: "Early Modern", min: 1500, max: 1800 },
  { id: "modern", label: "Modern", min: 1800, max: 3000 },
] as const;
export type EraId = (typeof ERAS)[number]["id"];

export interface SearchFilters {
  type?: EntityTypeFilter;
  era?: EraId;
}

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
  /** Highlighted snippet (HTML with <mark> wrappers) from ts_headline. */
  snippet: string | null;
  rank: number;
  /** Where this hit came from. Useful for debugging "why did this rank here?". */
  source?: "fts" | "vector" | "fused";
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
  snippet: string | null;
  rank: number;
} & Record<string, unknown>;

const FILTER_TYPE = (f: SearchFilters) =>
  f.type ? sql`AND type = ${f.type}` : sql``;

const FILTER_ERA = (f: SearchFilters) => {
  const era = f.era ? ERAS.find((e) => e.id === f.era) ?? null : null;
  return era ? sql`AND date_start BETWEEN ${era.min} AND ${era.max}` : sql``;
};

/**
 * Full-text search over name + summary. Highlights matches via ts_headline
 * and ranks by ts_rank + a tier bonus.
 */
export async function searchByText(
  query: string,
  filters: SearchFilters = {},
  limit = 40,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // websearch_to_tsquery supports quoted phrases, OR, leading "-" for
  // negation. ts_headline wraps matches in <mark>...</mark> for the UI.
  const rows = await withRetry("searchByText", () =>
    db.execute<RawHit>(sql`
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
        ts_headline(
          'english',
          COALESCE(summary, name),
          q,
          'StartSel=<mark>, StopSel=</mark>, MaxWords=28, MinWords=12, ShortWord=3, MaxFragments=2, FragmentDelimiter=" … "'
        ) AS snippet,
        ts_rank(search_text, q) + (tier * 0.05) AS rank
      FROM entities, websearch_to_tsquery('english', ${trimmed}) q
      WHERE search_text @@ q
        ${FILTER_TYPE(filters)}
        ${FILTER_ERA(filters)}
      ORDER BY rank DESC, tier DESC, name ASC
      LIMIT ${limit}
    `),
  );

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
    snippet: r.snippet,
    rank: r.rank,
    source: "fts",
  }));
}

/**
 * Embed the query, then cosine-rank entities by their stored embedding.
 * Snippet is the first ~140 chars of the summary; vector hits don't have
 * keyword spans to highlight.
 */
export async function searchByVector(
  query: string,
  filters: SearchFilters = {},
  limit = 40,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let queryVector: number[];
  try {
    const r = await embed({ model: MODEL_EMBED, value: trimmed });
    queryVector = r.embedding;
  } catch (err) {
    // Vector search is the second leg; if embedding fails we degrade
    // gracefully to FTS-only rather than failing the whole request.
    console.warn("[search] embed failed; falling back to FTS-only", err);
    return [];
  }

  const vec = `[${queryVector.join(",")}]`;

  const rows = await withRetry("searchByVector", () =>
    db.execute<RawHit>(sql`
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
        LEFT(COALESCE(summary, ''), 220) AS snippet,
        1 - (embedding <=> ${vec}::vector) AS rank
      FROM entities
      WHERE embedding IS NOT NULL
        ${FILTER_TYPE(filters)}
        ${FILTER_ERA(filters)}
      ORDER BY embedding <=> ${vec}::vector
      LIMIT ${limit}
    `),
  );

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
    snippet: r.snippet,
    rank: r.rank,
    source: "vector",
  }));
}

/**
 * Reciprocal Rank Fusion. RRF score = sum over lists of 1/(k + rank_in_list).
 *
 * Why RRF rather than weighted score average: the FTS `ts_rank` and the
 * cosine similarity live on totally different scales, and the cosine
 * similarity distribution shifts with corpus size. RRF only consumes the
 * *position* of each hit within its list, so it's robust to all of that.
 * The k=60 default is the constant from the original RRF paper (Cormack
 * et al., 2009).
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
      if (prev) {
        prev.score += inc;
        // Prefer the FTS version (it carries the highlighted snippet).
        if (hit.source === "fts" && prev.hit.source !== "fts") {
          prev.hit = { ...hit };
        }
      } else {
        scores.set(hit.qid, { hit: { ...hit }, score: inc });
      }
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ hit, score }) => ({ ...hit, rank: score, source: "fused" }));
}

/**
 * The default search: hybrid FTS + vector, fused via RRF. Each leg pulls
 * 2× the final limit so RRF has room to reorder.
 */
export async function search(
  query: string,
  filters: SearchFilters = {},
  limit = 20,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const pool = Math.max(limit * 2, 40);
  const [fts, vec] = await Promise.all([
    searchByText(trimmed, filters, pool),
    searchByVector(trimmed, filters, pool),
  ]);

  // If vector returned nothing (no embeddings yet, or embed call failed),
  // just return the FTS list directly — RRF on a single list is a no-op
  // reorder, but skipping it preserves the original ranking unchanged.
  if (vec.length === 0) return fts.slice(0, limit);

  return rrf([fts, vec], 60, limit);
}
