// Featured rotation: read today's row, fall back to the most recent.

import { desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "..";
import {
  entities,
  featuredRotation,
} from "../schema";
import { withRetry } from "../retry";
import type { EntityStub } from "./entity";

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodaysFeatured(): Promise<EntityStub[]> {
  return await withRetry("getTodaysFeatured", async () => {
    const today = todayUtcDateString();
    const row = await db
      .select()
      .from(featuredRotation)
      .where(eq(featuredRotation.date, today))
      .limit(1);
    const ids =
      row[0]?.entityIds ??
      (
        await db
          .select()
          .from(featuredRotation)
          .orderBy(desc(featuredRotation.date))
          .limit(1)
      )[0]?.entityIds ??
      [];

    if (!ids.length) return [];

    return await db
      .select({
        id: entities.id,
        slug: entities.slug,
        canonicalName: entities.canonicalName,
        entityType: entities.entityType,
        shortDescription: entities.shortDescription,
        consensusScore: entities.consensusScore,
      })
      .from(entities)
      .where(inArray(entities.id, ids));
  });
}

export async function refreshTodaysFeatured(args: {
  count: number;
}): Promise<{ date: string; entityIds: string[] }> {
  return await withRetry("refreshTodaysFeatured", async () => {
    const today = todayUtcDateString();
    const recent = await db
      .select({ entityIds: featuredRotation.entityIds })
      .from(featuredRotation)
      .where(
        gte(
          featuredRotation.date,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        ),
      );
    const exclude = new Set<string>(recent.flatMap((r) => r.entityIds));

    const candidates = await db.execute<{ id: string }>(sql`
      SELECT id FROM entities
      WHERE status = 'published'
        AND consensus_score >= 0.7
      ORDER BY random()
      LIMIT ${args.count * 4}
    `);
    const picks: string[] = [];
    for (const c of candidates) {
      if (picks.length >= args.count) break;
      if (exclude.has(c.id)) continue;
      picks.push(c.id);
    }
    // Top up if rotation history exhausted the candidate set.
    if (picks.length < args.count) {
      for (const c of candidates) {
        if (picks.length >= args.count) break;
        if (picks.includes(c.id)) continue;
        picks.push(c.id);
      }
    }

    await db
      .insert(featuredRotation)
      .values({
        date: today,
        entityIds: picks,
      })
      .onConflictDoUpdate({
        target: featuredRotation.date,
        set: { entityIds: picks, refreshedAt: new Date() },
      });

    return { date: today, entityIds: picks };
  });
}
