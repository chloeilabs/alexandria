// Entity read-side queries.

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "..";
import {
  entities,
  entityAliases,
  entityClaimedCitations,
  entityClaims,
  entityRelationships,
  entityTopics,
  type Entity,
  type EntityType,
  type ClaimVerdict,
} from "../schema";
import { withRetry } from "../retry";

export interface EntityStub {
  id: string;
  slug: string;
  canonicalName: string;
  entityType: string;
  shortDescription: string;
  consensusScore: number;
}

export interface EntityFull extends EntityStub {
  disambiguator: string | null;
  summary: string;
  narrative: string;
  structuredFacts: Record<string, unknown>;
  keyDates: Array<{ year: number; precision: string; label: string; kind: string }>;
  coords: { lat: number; lng: number } | null;
  generatorModel: string;
  verifierModel: string | null;
  claimFactualityScore: number | null;
  aliases: string[];
  topics: string[];
}

const stubColumns = {
  id: entities.id,
  slug: entities.slug,
  canonicalName: entities.canonicalName,
  entityType: entities.entityType,
  shortDescription: entities.shortDescription,
  consensusScore: entities.consensusScore,
} as const;

export async function getEntityBySlugOrId(
  slugOrId: string,
): Promise<Entity | null> {
  return await withRetry("getEntityBySlugOrId", async () => {
    const isUuid = /^[0-9a-f-]{36}$/i.test(slugOrId);
    const rows = await db
      .select()
      .from(entities)
      .where(isUuid ? eq(entities.id, slugOrId) : eq(entities.slug, slugOrId))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function getEntityFull(slugOrId: string): Promise<EntityFull | null> {
  const entity = await getEntityBySlugOrId(slugOrId);
  if (!entity) return null;

  const [aliasRows, topicRows] = await withRetry("getEntityFullSides", async () => {
    return await Promise.all([
      db
        .select({ alias: entityAliases.alias })
        .from(entityAliases)
        .where(eq(entityAliases.entityId, entity.id)),
      db
        .select({ topic: entityTopics.topic })
        .from(entityTopics)
        .where(eq(entityTopics.entityId, entity.id)),
    ]);
  });

  return {
    id: entity.id,
    slug: entity.slug,
    canonicalName: entity.canonicalName,
    disambiguator: entity.disambiguator,
    entityType: entity.entityType,
    shortDescription: entity.shortDescription,
    summary: entity.summary,
    narrative: entity.narrative,
    structuredFacts: (entity.structuredFacts as Record<string, unknown>) ?? {},
    keyDates: (entity.keyDates as EntityFull["keyDates"]) ?? [],
    coords: (entity.coords as EntityFull["coords"]) ?? null,
    generatorModel: entity.generatorModel,
    verifierModel: entity.verifierModel,
    consensusScore: entity.consensusScore,
    claimFactualityScore: entity.claimFactualityScore,
    aliases: aliasRows.map((r) => r.alias),
    topics: topicRows.map((r) => r.topic),
  };
}

export interface EntityClaimRow {
  claim: string;
  verdict: ClaimVerdict;
  entropy: number;
  distinctAnswers: number;
  nSamples: number;
  majorityAnswer: string | null;
  agreesWithClaim: boolean;
}

export async function getEntityClaims(
  entityId: string,
): Promise<EntityClaimRow[]> {
  return await withRetry("getEntityClaims", async () => {
    const rows = await db
      .select({
        claim: entityClaims.claim,
        verdict: entityClaims.verdict,
        entropy: entityClaims.entropy,
        distinctAnswers: entityClaims.distinctAnswers,
        nSamples: entityClaims.nSamples,
        majorityAnswer: entityClaims.majorityAnswer,
        agreesWithClaim: entityClaims.agreesWithClaim,
      })
      .from(entityClaims)
      .where(eq(entityClaims.entityId, entityId))
      .orderBy(desc(entityClaims.entropy), entityClaims.id);
    return rows.map((r) => ({
      ...r,
      verdict: r.verdict as ClaimVerdict,
    }));
  });
}

export async function listByType(args: {
  entityType: EntityType;
  limit: number;
  offset: number;
}): Promise<EntityStub[]> {
  return await withRetry("listByType", async () => {
    return await db
      .select(stubColumns)
      .from(entities)
      .where(
        and(
          eq(entities.entityType, args.entityType),
          eq(entities.status, "published"),
        ),
      )
      .orderBy(sql`${entities.canonicalName} ASC`)
      .limit(args.limit)
      .offset(args.offset);
  });
}

export async function listByTopic(args: {
  topic: string;
  limit: number;
  offset: number;
}): Promise<EntityStub[]> {
  return await withRetry("listByTopic", async () => {
    return await db
      .select(stubColumns)
      .from(entities)
      .innerJoin(entityTopics, eq(entityTopics.entityId, entities.id))
      .where(
        and(eq(entityTopics.topic, args.topic), eq(entities.status, "published")),
      )
      .orderBy(sql`${entities.canonicalName} ASC`)
      .limit(args.limit)
      .offset(args.offset);
  });
}

export async function listByDateRange(args: {
  yearStart: number;
  yearEnd: number;
  entityType?: EntityType;
  limit: number;
}): Promise<EntityStub[]> {
  return await withRetry("listByDateRange", async () => {
    const typeFilter = args.entityType
      ? sql`AND ${entities.entityType} = ${args.entityType}`
      : sql``;
    const rows = await db.execute<{
      id: string;
      slug: string;
      canonical_name: string;
      entity_type: string;
      short_description: string;
      consensus_score: number;
    }>(sql`
      SELECT id, slug, canonical_name, entity_type, short_description, consensus_score
      FROM entities, jsonb_array_elements(key_dates) AS kd
      WHERE status = 'published'
        AND (kd->>'year')::int BETWEEN ${args.yearStart} AND ${args.yearEnd}
        ${typeFilter}
      GROUP BY id
      ORDER BY MIN((kd->>'year')::int) ASC
      LIMIT ${args.limit}
    `);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      canonicalName: r.canonical_name,
      entityType: r.entity_type,
      shortDescription: r.short_description,
      consensusScore: r.consensus_score,
    }));
  });
}

export async function getRelated(args: {
  entityId: string;
  predicate?: string;
}): Promise<Array<{ predicate: string; entity: EntityStub }>> {
  return await withRetry("getRelated", async () => {
    const rows = await db
      .select({
        predicate: entityRelationships.predicate,
        entity: stubColumns,
      })
      .from(entityRelationships)
      .innerJoin(entities, eq(entities.id, entityRelationships.targetId))
      .where(
        and(
          eq(entityRelationships.sourceId, args.entityId),
          args.predicate
            ? eq(entityRelationships.predicate, args.predicate)
            : sql`TRUE`,
          eq(entities.status, "published"),
        ),
      )
      .limit(50);
    return rows;
  });
}

export async function getCitations(entityId: string) {
  return await withRetry("getCitations", async () => {
    return await db
      .select()
      .from(entityClaimedCitations)
      .where(eq(entityClaimedCitations.entityId, entityId));
  });
}

export async function entitiesByIds(ids: string[]): Promise<EntityStub[]> {
  if (!ids.length) return [];
  return await withRetry("entitiesByIds", async () => {
    return await db
      .select(stubColumns)
      .from(entities)
      .where(and(inArray(entities.id, ids), eq(entities.status, "published")));
  });
}

export async function typeCatalogCounts(): Promise<
  Array<{ entityType: string; count: number }>
> {
  return await withRetry("typeCatalogCounts", async () => {
    const rows = await db
      .select({
        entityType: entities.entityType,
        count: sql<number>`count(*)::int`,
      })
      .from(entities)
      .where(eq(entities.status, "published"))
      .groupBy(entities.entityType)
      .orderBy(desc(sql`count(*)`));
    return rows;
  });
}

export async function findBySlugOrAlias(query: string): Promise<EntityStub | null> {
  return await withRetry("findBySlugOrAlias", async () => {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const direct = await db
      .select(stubColumns)
      .from(entities)
      .where(or(eq(entities.slug, slug), eq(entities.canonicalName, query)))
      .limit(1);
    if (direct[0]) return direct[0];
    const aliased = await db
      .select(stubColumns)
      .from(entities)
      .innerJoin(entityAliases, eq(entityAliases.entityId, entities.id))
      .where(eq(entityAliases.alias, query))
      .limit(1);
    return aliased[0] ?? null;
  });
}
