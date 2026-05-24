// Fast type-ahead suggestion endpoint for the search input. FTS-only,
// no vector embedding — embedding the query would add 200–400ms per
// keystroke and isn't necessary for "show me entities whose name
// starts with X" prefix matching.
//
// Returns the top 8 hits with name + slug + type + dateStart so the
// client can render the dropdown without a follow-up request.

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SuggestHit {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  dateStartPrecision: string | null;
}

type RawRow = {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  date_start: number | null;
  date_start_precision: string | null;
} & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ q, hits: [] }, { headers: noCache() });
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 8),
    20,
  );

  // Two layers, fused by tier preference:
  //  - name ILIKE prefix match (fast btree on lower(name), if no index
  //    Postgres scans the curated corpus — trivial at current size)
  //  - FTS on search_text for substring/phrase matches
  // We order by: prefix match first (tighter signal), then ts_rank,
  // then tier desc (curated entries surface higher).
  const rows = await withRetry("search:suggest", () =>
    db.execute<RawRow>(sql`
      WITH q AS (
        SELECT
          ${q}::text AS query,
          websearch_to_tsquery('english', ${q}) AS tsq
      )
      SELECT
        e.qid, e.slug, e.name, e.type, e.tier,
        e.date_start, e.date_start_precision,
        CASE
          WHEN LOWER(e.name) LIKE LOWER((SELECT query FROM q) || '%')
            THEN 3
          WHEN LOWER(e.name) LIKE '%' || LOWER((SELECT query FROM q)) || '%'
            THEN 2
          ELSE 1
        END AS match_strength
      FROM entities e, q
      WHERE
        LOWER(e.name) LIKE '%' || LOWER(q.query) || '%'
        OR e.search_text @@ q.tsq
      ORDER BY
        match_strength DESC,
        e.tier DESC,
        e.inbound_link_count DESC,
        e.name ASC
      LIMIT ${limit}
    `),
  );

  const hits: SuggestHit[] = Array.from(rows).map((r) => ({
    qid: r.qid,
    slug: r.slug,
    name: r.name,
    type: r.type,
    tier: r.tier,
    dateStart: r.date_start,
    dateStartPrecision: r.date_start_precision,
  }));

  return NextResponse.json({ q, hits }, { headers: noCache() });
}

function noCache(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}
