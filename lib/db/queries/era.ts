// Data fetch for era landing pages. The 5 eras are defined in lib/search
// (Ancient / Classical / Medieval / Early Modern / Modern). Each page lists
// every entity whose date_start falls in the era's [min, max) window,
// grouped by civilizational tag so the page reads "in this era, here's
// what happened in each part of the world".

import { sql } from "drizzle-orm";
import { db } from "../index";
import { withRetry } from "../retry";
import { ERAS } from "../../search";

export interface EraEntry {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number;
  dateStartPrecision: string | null;
  dateEnd: number | null;
  dateEndPrecision: string | null;
  summary: string | null;
  heroUrl: string | null;
  /** All civ tag slugs this entity carries. */
  civTags: string[];
}

export interface EraData {
  id: string;
  label: string;
  min: number;
  max: number;
  entryCount: number;
  entries: EraEntry[];
}

export function eraById(id: string) {
  return ERAS.find((e) => e.id === id) ?? null;
}

/**
 * Counts only. Used by the index page so we don't pull every entity
 * just to render five rows.
 */
export async function getEraCounts(): Promise<
  Array<{ id: string; label: string; min: number; max: number; entryCount: number }>
> {
  return withRetry("getEraCounts", async () => {
    const rows = await db.execute<{ era_id: string; n: number }>(sql`
      SELECT
        CASE
          WHEN date_start < -1000 THEN 'ancient'
          WHEN date_start < 500   THEN 'classical'
          WHEN date_start < 1500  THEN 'medieval'
          WHEN date_start < 1800  THEN 'early-modern'
          ELSE                         'modern'
        END AS era_id,
        COUNT(*)::int AS n
      FROM entities
      WHERE date_start IS NOT NULL
      GROUP BY era_id
    `);
    const byId = new Map<string, number>();
    for (const r of Array.from(rows)) byId.set(r.era_id, r.n);
    return ERAS.map((e) => ({
      id: e.id,
      label: e.label,
      min: e.min,
      max: e.max,
      entryCount: byId.get(e.id) ?? 0,
    }));
  });
}

export async function getEraBySlug(id: string): Promise<EraData | null> {
  const era = eraById(id);
  if (!era) return null;
  return withRetry("getEraBySlug", () => getEraBySlugInner(era));
}

async function getEraBySlugInner(era: {
  id: string;
  label: string;
  min: number;
  max: number;
}): Promise<EraData> {
  type Row = {
    qid: string;
    slug: string;
    name: string;
    type: string;
    tier: number;
    date_start: number;
    date_start_precision: string | null;
    date_end: number | null;
    date_end_precision: string | null;
    summary: string | null;
    hero_url: string | null;
    civ_tags: string[];
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
      ) AS hero_url,
      COALESCE(
        ARRAY_AGG(er.region_value) FILTER (WHERE er.region_kind = 'civilizational'),
        ARRAY[]::varchar[]
      ) AS civ_tags
    FROM entities e
    LEFT JOIN entity_regions er ON er.entity_qid = e.qid
    WHERE e.date_start IS NOT NULL
      AND e.date_start >= ${era.min}
      AND e.date_start <  ${era.max}
    GROUP BY e.qid
    ORDER BY e.date_start ASC, e.tier DESC, e.name ASC
  `);

  const entries = Array.from(rows).map((r) => ({
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
    civTags: r.civ_tags ?? [],
  }));

  return {
    id: era.id,
    label: era.label,
    min: era.min,
    max: era.max,
    entryCount: entries.length,
    entries,
  };
}
