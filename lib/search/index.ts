// Hybrid entity search.
//
// V1: Postgres full-text search via the generated `search_text` tsvector
// column (GIN-indexed). Ranks by ts_rank weighted by tier (curated content
// surfaces above stubs). ts_headline produces highlighted snippets with
// matched terms wrapped in <mark>.
//
// Facets: optional `type` and `era` filters. Era buckets are derived from
// date_start.
//
// V2 (deferred until embedding provider is chosen): add pgvector cosine
// similarity on the `embedding` column and combine via Reciprocal Rank
// Fusion. The structure here is intentionally written so the FTS path is
// a drop-in component of the eventual RRF.

import { sql } from "drizzle-orm";
import { db } from "../db";

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

/**
 * Full-text search over name + summary. Highlights matches via ts_headline
 * and ranks by ts_rank + a tier bonus.
 */
export async function searchByText(
  query: string,
  filters: SearchFilters = {},
  limit = 20,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const era = filters.era
    ? ERAS.find((e) => e.id === filters.era) ?? null
    : null;

  // websearch_to_tsquery supports quoted phrases, OR, leading "-" for
  // negation. ts_headline wraps matches in <mark>...</mark> for the UI.
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
      ts_headline(
        'english',
        COALESCE(summary, name),
        q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=28, MinWords=12, ShortWord=3, MaxFragments=2, FragmentDelimiter=" … "'
      ) AS snippet,
      ts_rank(search_text, q) + (tier * 0.05) AS rank
    FROM entities, websearch_to_tsquery('english', ${trimmed}) q
    WHERE search_text @@ q
      ${filters.type ? sql`AND type = ${filters.type}` : sql``}
      ${era ? sql`AND date_start BETWEEN ${era.min} AND ${era.max}` : sql``}
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
    snippet: r.snippet,
    rank: r.rank,
  }));
}

/**
 * Reciprocal Rank Fusion. Reserved for when pgvector embeddings are wired.
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
