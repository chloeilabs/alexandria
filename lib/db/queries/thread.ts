// Data fetch for curated threads.

import { sql, eq, asc, desc } from "drizzle-orm";
import { db } from "../index";
import { withRetry } from "../retry";
import { threads, threadEntries, entities } from "../schema";

export interface ThreadEntryWithEntity {
  position: number;
  note: string | null;
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  dateStartPrecision: string | null;
  dateEnd: number | null;
  dateEndPrecision: string | null;
  summary: string | null;
  heroUrl: string | null;
}

export interface ThreadData {
  id: number;
  slug: string;
  title: string;
  blurb: string | null;
  intro: string | null;
  featured: boolean;
  entries: ThreadEntryWithEntity[];
}

export async function getAllThreads(): Promise<
  Array<{ id: number; slug: string; title: string; blurb: string | null; entryCount: number; featured: boolean }>
> {
  return withRetry("getAllThreads", async () => {
    const rows = await db.execute<{
      id: number;
      slug: string;
      title: string;
      blurb: string | null;
      entry_count: number;
      featured: number;
    }>(sql`
      SELECT
        t.id,
        t.slug,
        t.title,
        t.blurb,
        t.featured,
        (SELECT COUNT(*)::int FROM thread_entries WHERE thread_id = t.id) AS entry_count
      FROM threads t
      ORDER BY t.featured DESC, t.created_at DESC, t.id ASC
    `);
    return Array.from(rows).map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      blurb: r.blurb,
      entryCount: r.entry_count,
      featured: r.featured === 1,
    }));
  });
}

export async function getThreadBySlug(slug: string): Promise<ThreadData | null> {
  return withRetry("getThreadBySlug", () => getThreadBySlugInner(slug));
}

async function getThreadBySlugInner(slug: string): Promise<ThreadData | null> {
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.slug, slug))
    .limit(1);
  if (!thread) return null;

  const rows = await db
    .select({
      position: threadEntries.position,
      note: threadEntries.note,
      qid: entities.qid,
      slug: entities.slug,
      name: entities.name,
      type: entities.type,
      tier: entities.tier,
      dateStart: entities.dateStart,
      dateStartPrecision: entities.dateStartPrecision,
      dateEnd: entities.dateEnd,
      dateEndPrecision: entities.dateEndPrecision,
      summary: entities.summary,
    })
    .from(threadEntries)
    .innerJoin(entities, eq(entities.qid, threadEntries.entityQid))
    .where(eq(threadEntries.threadId, thread.id))
    .orderBy(asc(threadEntries.position));

  // Hero image per entry — one extra query keeps the join above clean.
  const heroRows = await db.execute<{ entity_qid: string; url: string }>(sql`
    SELECT DISTINCT ON (entity_qid) entity_qid, commons_url AS url
    FROM media
    WHERE entity_qid IN (
      SELECT entity_qid FROM thread_entries WHERE thread_id = ${thread.id}
    )
    AND kind = 'image'
    ORDER BY entity_qid, id ASC
  `);
  const heroByQid = new Map<string, string>(
    Array.from(heroRows).map((r) => [r.entity_qid, r.url]),
  );

  return {
    id: thread.id,
    slug: thread.slug,
    title: thread.title,
    blurb: thread.blurb,
    intro: thread.intro,
    featured: thread.featured === 1,
    entries: rows.map((r) => ({
      position: r.position,
      note: r.note,
      qid: r.qid,
      slug: r.slug,
      name: r.name,
      type: r.type,
      tier: r.tier,
      dateStart: r.dateStart,
      dateStartPrecision: r.dateStartPrecision,
      dateEnd: r.dateEnd,
      dateEndPrecision: r.dateEndPrecision,
      summary: r.summary,
      heroUrl: heroByQid.get(r.qid) ?? null,
    })),
  };
}

export async function getFeaturedThread(): Promise<ThreadData | null> {
  return withRetry("getFeaturedThread", async () => {
    const [t] = await db
      .select({ slug: threads.slug })
      .from(threads)
      .where(eq(threads.featured, 1))
      .orderBy(desc(threads.updatedAt))
      .limit(1);
    if (!t) return null;
    return getThreadBySlugInner(t.slug);
  });
}
