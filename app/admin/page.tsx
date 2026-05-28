import Link from "next/link";
import { desc, eq, isNull, sql } from "drizzle-orm";

import { Container } from "@/components/layout/Container";
import { ReviewList, type FlaggedEntry } from "@/components/admin/ReviewList";
import { db } from "@/lib/db";
import { entities, reviewQueue } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";

async function loadReviewQueue(): Promise<FlaggedEntry[]> {
  return await withRetry("loadReviewQueue", async () => {
    const rows = await db
      .select({
        reviewId: reviewQueue.id,
        entityId: reviewQueue.entityId,
        slug: entities.slug,
        canonicalName: entities.canonicalName,
        reason: reviewQueue.reason,
        severity: reviewQueue.severity,
        disagreements: reviewQueue.disagreementJsonb,
        consensusScore: entities.consensusScore,
      })
      .from(reviewQueue)
      .innerJoin(entities, eq(entities.id, reviewQueue.entityId))
      .where(isNull(reviewQueue.resolvedAt))
      .orderBy(desc(reviewQueue.severity), desc(reviewQueue.id))
      .limit(50);
    void sql; // silence import — used implicitly via orderBy
    return rows.map((r) => ({
      reviewId: r.reviewId,
      entityId: r.entityId,
      slug: r.slug,
      canonicalName: r.canonicalName,
      reason: r.reason,
      severity: r.severity,
      disagreements: (r.disagreements as FlaggedEntry["disagreements"]) ?? [],
      consensusScore: r.consensusScore,
    }));
  });
}

export default async function AdminPage() {
  const rows = await loadReviewQueue();
  return (
    <main className="py-12">
      <Container>
        <header className="mb-8 flex items-baseline justify-between flex-wrap gap-y-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
              ¶ Admin
            </p>
            <h1
              className="font-display italic"
              style={{
                fontSize: 48,
                letterSpacing: "-0.015em",
                lineHeight: 1.04,
              }}
            >
              Review queue
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-2">
              {rows.length} open {rows.length === 1 ? "item" : "items"}
            </p>
          </div>
          <Link
            href="/admin/seeds"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors"
          >
            Seed queue →
          </Link>
        </header>
        <ReviewList rows={rows} />
      </Container>
    </main>
  );
}
