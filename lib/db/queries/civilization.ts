// Data fetch for the civilization landing pages. Returns every entity
// tagged with the given civilizational slug, with light context for each
// (type, dates, summary first sentence, hero image if any), plus the
// adjacent civilizations they overlap with so users can hop sideways.

import { sql } from "drizzle-orm";
import { db } from "../index";
import { withRetry } from "../retry";

export interface CivEntry {
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
  heroUrl: string | null;
}

export interface AdjacentCiv {
  slug: string;
  /** How many entities are tagged with both this civ and the queried one. */
  overlap: number;
}

export interface CivilizationData {
  /** The slug the route asked for (e.g. "silk-roads"). */
  slug: string;
  /** Count of entities in this civ. */
  entryCount: number;
  /** Year span across entities. */
  minYear: number | null;
  maxYear: number | null;
  /** Entities ordered chronologically (undated last). */
  entries: CivEntry[];
  /** Other civs whose entries overlap with this one, top-down by overlap. */
  adjacent: AdjacentCiv[];
}

/**
 * All civilizational tag slugs that have at least one tagged entity.
 * Used to render the index page and for `generateStaticParams`.
 */
export async function getAllCivilizationSlugs(): Promise<
  Array<{ slug: string; entryCount: number; minYear: number | null; maxYear: number | null }>
> {
  return withRetry("getAllCivilizationSlugs", async () => {
    const rows = await db.execute<{
      slug: string;
      entry_count: number;
      min_year: number | null;
      max_year: number | null;
    }>(sql`
      SELECT
        er.region_value AS slug,
        COUNT(DISTINCT e.qid)::int AS entry_count,
        MIN(e.date_start) AS min_year,
        MAX(e.date_start) AS max_year
      FROM entity_regions er
      JOIN entities e ON e.qid = er.entity_qid
      WHERE er.region_kind = 'civilizational'
      GROUP BY er.region_value
      ORDER BY entry_count DESC, er.region_value ASC
    `);
    return Array.from(rows).map((r) => ({
      slug: r.slug,
      entryCount: r.entry_count,
      minYear: r.min_year,
      maxYear: r.max_year,
    }));
  });
}

export async function getCivilizationBySlug(
  slug: string,
): Promise<CivilizationData | null> {
  return withRetry("getCivilizationBySlug", () =>
    getCivilizationBySlugInner(slug),
  );
}

async function getCivilizationBySlugInner(
  slug: string,
): Promise<CivilizationData | null> {
  // One round-trip: entities + first media row joined laterally.
  type Row = {
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
    hero_url: string | null;
  };
  const rows = await db.execute<Row>(sql`
    SELECT
      e.qid,
      e.slug,
      e.name,
      e.type,
      e.tier,
      e.date_start,
      e.date_start_precision,
      e.date_end,
      e.date_end_precision,
      e.summary,
      (
        SELECT m.commons_url FROM media m
        WHERE m.entity_qid = e.qid AND m.kind = 'image'
        ORDER BY m.id ASC LIMIT 1
      ) AS hero_url
    FROM entities e
    JOIN entity_regions er ON er.entity_qid = e.qid
    WHERE er.region_kind = 'civilizational' AND er.region_value = ${slug}
    ORDER BY
      e.date_start IS NULL,  -- undated last
      e.date_start ASC,
      e.tier DESC,
      e.name ASC
  `);

  const entries = Array.from(rows);
  if (entries.length === 0) return null;

  const dated = entries.filter((r) => r.date_start != null);
  const minYear = dated.length > 0 ? dated[0]!.date_start : null;
  const maxYear =
    dated.length > 0
      ? Math.max(...dated.map((r) => r.date_start as number))
      : null;

  // Adjacent civilizations: other civ tags carried by entities in this one,
  // ranked by overlap count.
  const adjacentRows = await db.execute<{ slug: string; overlap: number }>(sql`
    SELECT er2.region_value AS slug, COUNT(*)::int AS overlap
    FROM entity_regions er1
    JOIN entity_regions er2
      ON er2.entity_qid = er1.entity_qid
     AND er2.region_kind = 'civilizational'
     AND er2.region_value <> er1.region_value
    WHERE er1.region_kind = 'civilizational' AND er1.region_value = ${slug}
    GROUP BY er2.region_value
    ORDER BY overlap DESC, er2.region_value ASC
    LIMIT 8
  `);

  return {
    slug,
    entryCount: entries.length,
    minYear,
    maxYear,
    entries: entries.map((r) => ({
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
      heroUrl: r.hero_url,
    })),
    adjacent: Array.from(adjacentRows),
  };
}
