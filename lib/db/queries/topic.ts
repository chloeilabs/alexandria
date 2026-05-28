// Topic-cluster queries (browsing, co-occurrence).

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "..";
import { entities, entityTopics } from "../schema";
import { withRetry } from "../retry";

export async function topicCounts(): Promise<Array<{ topic: string; count: number }>> {
  return await withRetry("topicCounts", async () => {
    return await db
      .select({
        topic: entityTopics.topic,
        count: sql<number>`count(*)::int`,
      })
      .from(entityTopics)
      .innerJoin(entities, eq(entities.id, entityTopics.entityId))
      .where(eq(entities.status, "published"))
      .groupBy(entityTopics.topic)
      .orderBy(sql`count(*) DESC`)
      .limit(200);
  });
}

export async function topicsForType(entityType: string): Promise<
  Array<{ topic: string; count: number }>
> {
  return await withRetry("topicsForType", async () => {
    return await db
      .select({
        topic: entityTopics.topic,
        count: sql<number>`count(*)::int`,
      })
      .from(entityTopics)
      .innerJoin(entities, eq(entities.id, entityTopics.entityId))
      .where(
        and(
          eq(entities.entityType, entityType),
          eq(entities.status, "published"),
        ),
      )
      .groupBy(entityTopics.topic)
      .orderBy(sql`count(*) DESC`)
      .limit(20);
  });
}

export async function relatedTopics(topic: string): Promise<
  Array<{ topic: string; count: number }>
> {
  return await withRetry("relatedTopics", async () => {
    const rows = await db.execute<{ topic: string; count: number }>(sql`
      WITH peers AS (
        SELECT DISTINCT et2.entity_id
        FROM entity_topics et1
        JOIN entity_topics et2 ON et1.entity_id = et2.entity_id
        WHERE et1.topic = ${topic}
      )
      SELECT et.topic, count(*)::int AS count
      FROM entity_topics et
      JOIN peers p ON p.entity_id = et.entity_id
      JOIN entities e ON e.id = et.entity_id
      WHERE et.topic <> ${topic}
        AND e.status = 'published'
      GROUP BY et.topic
      ORDER BY count DESC
      LIMIT 10
    `);
    return rows.map((r) => ({ topic: r.topic, count: r.count }));
  });
}

void ne; // silence unused import warning when filtering predicates change
