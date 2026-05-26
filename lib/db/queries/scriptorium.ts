// Aggregate stats used by the SCRIPTORIUM frontispiece + plate.
// One round-trip, all the numbers the codex pages need.

import { sql } from "drizzle-orm";
import { db } from "../index";
import { withRetry } from "../retry";

export interface ScriptoriumStats {
  entries: number;
  civilizations: number;
  eras: number;
  tier3: number;
  /** Range in years across all dated entities (e.g. 5_500). */
  yearsSpanned: number;
  minYear: number | null;
  maxYear: number | null;
}

export async function getScriptoriumStats(): Promise<ScriptoriumStats> {
  return withRetry("getScriptoriumStats", async () => {
    type Row = {
      entries: number;
      civilizations: number;
      tier3: number;
      min_year: number | null;
      max_year: number | null;
    };
    const [row] = await db.execute<Row>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM entities WHERE tier >= 1)                       AS entries,
        (SELECT COUNT(DISTINCT region_value)::int
           FROM entity_regions WHERE region_kind = 'civilizational')                AS civilizations,
        (SELECT COUNT(*)::int FROM entities WHERE tier = 3)                        AS tier3,
        (SELECT MIN(date_start) FROM entities WHERE date_start IS NOT NULL)        AS min_year,
        (SELECT MAX(date_start) FROM entities WHERE date_start IS NOT NULL)        AS max_year
    `);
    const minYear = row?.min_year ?? null;
    const maxYear = row?.max_year ?? null;
    const yearsSpanned =
      minYear != null && maxYear != null ? maxYear - minYear : 0;
    return {
      entries: row?.entries ?? 0,
      civilizations: row?.civilizations ?? 0,
      eras: 5,
      tier3: row?.tier3 ?? 0,
      yearsSpanned,
      minYear,
      maxYear,
    };
  });
}
