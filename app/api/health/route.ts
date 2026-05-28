import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { entities, generationRuns } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    const [counts, lastRun] = await withRetry("health", async () =>
      Promise.all([
        db
          .select({
            status: entities.status,
            count: sql<number>`count(*)::int`,
          })
          .from(entities)
          .groupBy(entities.status),
        db
          .select({
            jobKind: generationRuns.jobKind,
            model: generationRuns.model,
            apiCostUsd: generationRuns.apiCostUsd,
            finishedAt: generationRuns.finishedAt,
          })
          .from(generationRuns)
          .where(eq(generationRuns.status, "completed"))
          .orderBy(desc(generationRuns.id))
          .limit(1),
      ]),
    );

    return NextResponse.json(
      {
        ok: true,
        db_roundtrip_ms: Date.now() - startedAt,
        entity_counts: counts.reduce<Record<string, number>>(
          (acc, r) => ({ ...acc, [r.status]: r.count }),
          {},
        ),
        last_generation_run: lastRun[0] ?? null,
        commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 503 },
    );
  }
}
