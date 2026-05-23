// Server-side data fetch helpers for entity pages.

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../index";
import {
  type Entity,
  type Source,
  entities,
  entityAliases,
  media,
  relationships,
  sources,
} from "../schema";

export interface RelatedEntity {
  entity: Entity;
  predicate: string;
  direction: "outbound" | "inbound";
}

export interface EntityPageData {
  entity: Entity;
  aliases: Array<{ alias: string; language: string }>;
  related: RelatedEntity[];
  /** QIDs that this entity links to but aren't in our DB yet (stubs). */
  orphanTargets: Array<{ qid: string; predicate: string }>;
  sources: Source[];
  media: Array<{ url: string; localPath: string | null; caption: string | null }>;
}

const RELATED_CAP = 12;

export async function getEntityBySlug(
  slug: string,
): Promise<EntityPageData | null> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.slug, slug))
    .limit(1);

  if (!entity) return null;

  const aliasRows = await db
    .select({ alias: entityAliases.alias, language: entityAliases.language })
    .from(entityAliases)
    .where(eq(entityAliases.entityQid, entity.qid));

  // Outbound: this entity → others
  const outbound = await db
    .select({
      predicate: relationships.predicate,
      targetQid: relationships.targetQid,
    })
    .from(relationships)
    .where(eq(relationships.sourceQid, entity.qid))
    .limit(50);

  // Inbound: others → this entity
  const inbound = await db
    .select({
      predicate: relationships.predicate,
      sourceQid: relationships.sourceQid,
    })
    .from(relationships)
    .where(eq(relationships.targetQid, entity.qid))
    .limit(50);

  // Resolve target/source QIDs to entities in our DB
  const candidateQids = Array.from(
    new Set([
      ...outbound.map((r) => r.targetQid),
      ...inbound.map((r) => r.sourceQid),
    ]),
  );

  const presentEntities =
    candidateQids.length > 0
      ? await db
          .select()
          .from(entities)
          .where(inArray(entities.qid, candidateQids))
      : [];
  const presentMap = new Map(presentEntities.map((e) => [e.qid, e]));

  const related: RelatedEntity[] = [];
  for (const r of outbound) {
    const e = presentMap.get(r.targetQid);
    if (e)
      related.push({ entity: e, predicate: r.predicate, direction: "outbound" });
  }
  for (const r of inbound) {
    const e = presentMap.get(r.sourceQid);
    if (e)
      related.push({ entity: e, predicate: r.predicate, direction: "inbound" });
  }

  // Sort related: by target entity's tier (curated first), then by name.
  related.sort((a, b) => {
    if (b.entity.tier !== a.entity.tier) return b.entity.tier - a.entity.tier;
    return a.entity.name.localeCompare(b.entity.name);
  });

  const orphanTargets: EntityPageData["orphanTargets"] = [];
  for (const r of outbound) {
    if (!presentMap.has(r.targetQid)) {
      orphanTargets.push({ qid: r.targetQid, predicate: r.predicate });
    }
  }

  const srcRows = await db
    .select()
    .from(sources)
    .where(eq(sources.entityQid, entity.qid));

  const mediaRows = await db
    .select({
      url: media.commonsUrl,
      localPath: media.localPath,
      caption: media.caption,
    })
    .from(media)
    .where(eq(media.entityQid, entity.qid));

  return {
    entity,
    aliases: aliasRows,
    related: related.slice(0, RELATED_CAP),
    orphanTargets: orphanTargets.slice(0, 12),
    sources: srcRows,
    media: mediaRows,
  };
}

export async function getAllEntitySlugs(limit = 200): Promise<
  Array<{
    slug: string;
    name: string;
    type: string;
    tier: number;
    dateStart: number | null;
    dateEnd: number | null;
  }>
> {
  return db
    .select({
      slug: entities.slug,
      name: entities.name,
      type: entities.type,
      tier: entities.tier,
      dateStart: entities.dateStart,
      dateEnd: entities.dateEnd,
    })
    .from(entities)
    .orderBy(sql`${entities.tier} DESC, ${entities.name} ASC`)
    .limit(limit);
}
