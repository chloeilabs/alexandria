// Production health check endpoint.
//
// Returns a JSON snapshot of the system's vital signs. Uptime monitors
// (UptimeRobot, BetterStack, etc.) can poll this for a 200 ok / 503
// degraded signal.
//
// Reports:
//   - DB connectivity (SELECT 1 success + roundtrip time)
//   - Entity count
//   - Most recent fact-check review timestamp
//   - Most recent featured-cache row (cron health)
//   - Build SHA + deployment env
//
// Public by design — no secrets, only counts + timestamps. If you want
// auth you can add a Bearer check; we don't.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthCheck {
  ok: boolean;
  status: "ok" | "degraded" | "down";
  checked_at: string;
  db: {
    ok: boolean;
    roundtrip_ms: number;
    entities: number;
    tier_breakdown: Record<string, number>;
  };
  fact_check: {
    most_recent_review: string | null;
    total_reviews: number;
  };
  featured_cache: {
    most_recent_at: string | null;
    age_hours: number | null;
  };
  budget: {
    monthly_spend_usd: number;
    monthly_cap_usd: number;
    pct_used: number;
  };
  bias: {
    last_diff_at: string | null;
    flagged_civs: string[];
  };
  build: {
    commit_sha: string;
    env: string;
    region: string | null;
  };
}

const MONTHLY_CAP_USD = Number(process.env.MONTHLY_BUDGET_USD ?? 600);

export async function GET() {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  // Build info comes from Vercel-provided env vars at runtime.
  const buildInfo = {
    commit_sha:
      (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    env: process.env.VERCEL_ENV ?? "development",
    region: process.env.VERCEL_REGION ?? null,
  };

  try {
    type HealthRow = {
      total: number;
      tier_breakdown: Record<string, number>;
      most_recent_review: Date | null;
      total_reviews: number;
      cache_at: Date | null;
      cache_meta: {
        bias?: {
          snapshot?: { generated_at?: string };
          flagged?: Array<{ civ: string }>;
        };
      } | null;
      monthly_spend: string;
    };
    const result = await withRetry("health", async () => {
      const dbStart = Date.now();
      // All queries in one round trip via a single CTE.
      const rows = await db.execute<HealthRow>(sql`
        WITH counts AS (
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE tier = 0)::int AS t0,
            COUNT(*) FILTER (WHERE tier = 1)::int AS t1,
            COUNT(*) FILTER (WHERE tier = 2)::int AS t2,
            COUNT(*) FILTER (WHERE tier = 3)::int AS t3
          FROM entities
        ),
        reviews AS (
          -- Count DISTINCT entities reviewed (not raw rows): re-runs
          -- of fix-flagged-entities insert additional rows per entity,
          -- so a naive COUNT(*) inflates the coverage metric.
          SELECT
            MAX(created_at) AS most_recent_review,
            COUNT(DISTINCT entity_qid)::int AS total_reviews
          FROM fact_check_reviews
        ),
        cache AS (
          SELECT created_at AS cache_at, meta AS cache_meta
          FROM featured_cache
          ORDER BY created_at DESC
          LIMIT 1
        ),
        spend AS (
          SELECT COALESCE(SUM(api_cost_usd), 0)::text AS monthly_spend
          FROM pipeline_runs
          WHERE date_trunc('month', started_at) = date_trunc('month', NOW())
            AND status IN ('completed', 'running')
        )
        SELECT
          c.total,
          jsonb_build_object(
            '0', c.t0, '1', c.t1, '2', c.t2, '3', c.t3
          ) AS tier_breakdown,
          r.most_recent_review,
          r.total_reviews,
          ca.cache_at,
          ca.cache_meta,
          s.monthly_spend
        FROM counts c, reviews r
        LEFT JOIN cache ca ON true
        CROSS JOIN spend s
      `);
      const dbRoundtripMs = Date.now() - dbStart;
      const row = Array.from(rows)[0];
      if (!row) throw new Error("health query returned no rows");
      return { row, dbRoundtripMs };
    });

    const row = result.row;
    const cacheAt = row.cache_at ? new Date(row.cache_at) : null;
    const cacheAgeHours = cacheAt
      ? (Date.now() - cacheAt.getTime()) / (1000 * 60 * 60)
      : null;

    const monthlySpend = Number(row.monthly_spend ?? "0");
    const pctUsed =
      MONTHLY_CAP_USD > 0
        ? Number(((monthlySpend / MONTHLY_CAP_USD) * 100).toFixed(2))
        : 0;

    const flaggedCivs =
      row.cache_meta?.bias?.flagged?.map((f) => f.civ) ?? [];
    const lastDiffAt = row.cache_meta?.bias?.snapshot?.generated_at ?? null;

    // Degraded if: featured cache is stale (>36h, the cron should have
    // refreshed it nightly), DB roundtrip is slow (>2s, indicates Neon
    // cold-start hang), no fact-check reviews exist at all, monthly cap
    // is > 95% used, or bias-diff flagged a >5pp drop on any civ.
    const degraded =
      result.dbRoundtripMs > 2000 ||
      (cacheAgeHours != null && cacheAgeHours > 36) ||
      row.total_reviews === 0 ||
      pctUsed > 95 ||
      flaggedCivs.length > 0;

    const status: HealthCheck["status"] = degraded ? "degraded" : "ok";

    const payload: HealthCheck = {
      ok: true,
      status,
      checked_at: checkedAt,
      db: {
        ok: true,
        roundtrip_ms: result.dbRoundtripMs,
        entities: row.total,
        tier_breakdown: row.tier_breakdown,
      },
      fact_check: {
        most_recent_review:
          row.most_recent_review?.toISOString?.() ?? null,
        total_reviews: row.total_reviews,
      },
      featured_cache: {
        most_recent_at: cacheAt?.toISOString() ?? null,
        age_hours: cacheAgeHours == null ? null : Number(cacheAgeHours.toFixed(2)),
      },
      budget: {
        monthly_spend_usd: Number(monthlySpend.toFixed(4)),
        monthly_cap_usd: MONTHLY_CAP_USD,
        pct_used: pctUsed,
      },
      bias: {
        last_diff_at: lastDiffAt,
        flagged_civs: flaggedCivs,
      },
      build: buildInfo,
    };

    return NextResponse.json(payload, {
      status: status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    return NextResponse.json(
      {
        ok: false,
        status: "down" as const,
        checked_at: checkedAt,
        db: {
          ok: false,
          roundtrip_ms: elapsed,
          error: err instanceof Error ? err.message : "Unknown error",
        },
        build: buildInfo,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
