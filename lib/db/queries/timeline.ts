// Data fetch for the timeline view. Returns one row per entity with its
// civilizational tags inlined.

import { sql } from "drizzle-orm";
import { db } from "../index";

export interface TimelineEvent {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number;
  dateEnd: number | null;
  dateStartPrecision: string | null;
  dateEndPrecision: string | null;
  civTags: string[];
}

type RawRow = {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  date_start: number;
  date_end: number | null;
  date_start_precision: string | null;
  date_end_precision: string | null;
  civ_tags: string[];
} & Record<string, unknown>;

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  let rows: Awaited<ReturnType<typeof db.execute<RawRow>>>;
  try {
    rows = await db.execute<RawRow>(sql`
      SELECT
        e.qid,
        e.slug,
        e.name,
        e.type,
        e.tier,
        e.date_start,
        e.date_end,
        e.date_start_precision,
        e.date_end_precision,
        COALESCE(
          ARRAY_AGG(er.region_value) FILTER (WHERE er.region_kind = 'civilizational'),
          ARRAY[]::varchar[]
        ) AS civ_tags
      FROM entities e
      LEFT JOIN entity_regions er ON er.entity_qid = e.qid
      WHERE e.date_start IS NOT NULL
      GROUP BY e.qid
      ORDER BY e.date_start ASC
    `);
  } catch (err) {
    const e = err as Record<string, unknown>;
    console.error("[getTimelineEvents] postgres error", {
      message: e.message,
      code: e.code,
      severity: e.severity,
      detail: e.detail,
      hint: e.hint,
      schema: e.schema_name,
      table: e.table_name,
      where: e.where,
      query: e.query,
    });
    throw err;
  }

  return Array.from(rows).map((r) => ({
    qid: r.qid,
    slug: r.slug,
    name: r.name,
    type: r.type,
    tier: r.tier,
    dateStart: r.date_start,
    dateEnd: r.date_end,
    dateStartPrecision: r.date_start_precision,
    dateEndPrecision: r.date_end_precision,
    civTags: r.civ_tags ?? [],
  }));
}
