// Vercel Cron endpoint that refreshes the homepage featured rotation.
//
// Wired in vercel.json. Vercel invokes this with an Authorization
// header containing CRON_SECRET (set as a Vercel project env var).
// Any other caller gets a 401 — the endpoint is intentionally
// expensive (queries every Tier 1+ entity), so we don't expose it to
// random clients.
//
// Result: a new row in featured_cache. The reader
// getFeaturedEntities prefers the most recent row when it's < 36h old.

import { NextResponse, type NextRequest } from "next/server";
import { desc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { featuredCache } from "@/lib/db/schema";
import { computeFeaturedEntities } from "@/lib/db/queries/entity";
import { runCoverageDiff } from "@/pipeline/audit/coverage-diff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel cron uses GET.
export async function GET(req: NextRequest) {
  // Auth: Vercel cron sends `Authorization: Bearer <CRON_SECRET>`.
  // Allow local dev too — if no secret is configured we skip the check.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("unauthorized", { status: 401 });
    }
  }

  const t0 = Date.now();
  const featured = await computeFeaturedEntities(12, 2);

  // Run the bias-regression diff alongside the featured refresh. The
  // result is attached to the new featured_cache row's meta — /api/health
  // reads it back to surface flagged civs without a separate cron slot
  // (Vercel Hobby allows only 1 cron/day).
  let bias: Awaited<ReturnType<typeof runCoverageDiff>> | null = null;
  try {
    bias = await runCoverageDiff();
  } catch (err) {
    // Diff failure must not block the featured refresh — log and
    // continue with bias = null.
    console.warn("[cron] coverage-diff failed:", err);
  }

  // Insert the new row, then trim to the last 2 (one for live reads,
  // one to fall back on if the next cron run fails). Both ops in a
  // transaction so readers never see an empty cache mid-refresh.
  await db.transaction(async (tx) => {
    await tx.insert(featuredCache).values({
      entities: featured,
      meta: {
        count: featured.length,
        generatedInMs: Date.now() - t0,
        generatedAt: new Date().toISOString(),
        bias: bias
          ? {
              snapshot: bias.snapshot,
              flagged: bias.flagged,
            }
          : null,
      },
    });
    await tx.execute(sql`
      DELETE FROM featured_cache
      WHERE id NOT IN (
        SELECT id FROM featured_cache
        ORDER BY created_at DESC
        LIMIT 2
      )
    `);
  });

  // Look at the latest row to confirm it landed.
  const [latest] = await db
    .select({ id: featuredCache.id, createdAt: featuredCache.createdAt })
    .from(featuredCache)
    .orderBy(desc(featuredCache.createdAt))
    .limit(1);

  return NextResponse.json({
    ok: true,
    cacheId: latest?.id,
    cacheAt: latest?.createdAt,
    count: featured.length,
    generatedInMs: Date.now() - t0,
    bias_flagged_count: bias?.flagged.length ?? null,
  });
}
