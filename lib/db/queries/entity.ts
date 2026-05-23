// Server-side data fetch helpers for entity pages.

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "../index";
import { eraFor } from "../../format";
import {
  type Entity,
  type Source,
  entities,
  entityAliases,
  entityRegions,
  media,
  relationships,
  sources,
} from "../schema";

export interface RelatedEntity {
  entity: Entity;
  predicate: string;
  direction: "outbound" | "inbound";
}

export interface RegionPeer {
  qid: string;
  slug: string;
  name: string;
  type: string;
  dateStart: number | null;
  dateStartPrecision: string | null;
}

export interface SimilarEntity {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  dateStartPrecision: string | null;
  /** Cosine similarity in [0, 1]; higher = closer in embedding space. */
  similarity: number;
}

export interface EntityPageData {
  entity: Entity;
  aliases: Array<{ alias: string; language: string }>;
  related: RelatedEntity[];
  /** QIDs that this entity links to but aren't in our DB yet (stubs). */
  orphanTargets: Array<{ qid: string; predicate: string }>;
  sources: Source[];
  media: Array<{
    url: string;
    attribution: string;
    license: string;
  }>;
  /** Entities sharing at least one civilizational tag with this one. */
  regionPeers: RegionPeer[];
  primaryTag: string | null;
  /**
   * Closest neighbours by embedding cosine similarity. Surface this
   * alongside the relationship and region peers — it tends to find
   * conceptually adjacent entries that the Wikidata graph misses
   * (e.g. "Mansa Musa" → "Sundiata Keïta" even without a P-property link).
   */
  similar: SimilarEntity[];
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
      attribution: media.attribution,
      license: media.license,
    })
    .from(media)
    .where(eq(media.entityQid, entity.qid));

  // Civilizational tags for this entity → other entities sharing any tag.
  const civTagsRows = await db
    .select({ value: entityRegions.regionValue })
    .from(entityRegions)
    .where(
      sql`${entityRegions.entityQid} = ${entity.qid} AND ${entityRegions.regionKind} = 'civilizational'`,
    );
  const civTags = civTagsRows.map((r) => r.value);
  const primaryTag = civTags[0] ?? null;

  let regionPeers: RegionPeer[] = [];
  if (civTags.length > 0) {
    // selectDistinct dedupes when an entity matches multiple civ tags.
    const rows = await db
      .selectDistinct({
        qid: entities.qid,
        slug: entities.slug,
        name: entities.name,
        type: entities.type,
        tier: entities.tier,
        dateStart: entities.dateStart,
        dateStartPrecision: entities.dateStartPrecision,
      })
      .from(entities)
      .innerJoin(entityRegions, eq(entityRegions.entityQid, entities.qid))
      .where(
        and(
          eq(entityRegions.regionKind, "civilizational"),
          inArray(entityRegions.regionValue, civTags),
          ne(entities.qid, entity.qid),
        ),
      )
      .orderBy(desc(entities.tier), asc(entities.dateStart))
      .limit(8);

    regionPeers = rows.map((r) => ({
      qid: r.qid,
      slug: r.slug,
      name: r.name,
      type: r.type,
      dateStart: r.dateStart,
      dateStartPrecision: r.dateStartPrecision,
    }));
  }

  // Embedding-based "resonant" neighbours. Excludes the entity itself
  // AND anything we already showed under Connections / More-from-region
  // — those sections would otherwise duplicate names verbatim. Pull
  // 20 from the ANN query so we have slack after de-dup.
  const dedupQids = new Set<string>([
    ...related.map((r) => r.entity.qid),
    ...regionPeers.map((p) => p.qid),
  ]);
  let similar: SimilarEntity[] = [];
  if (entity.embedding) {
    type SimRow = {
      qid: string;
      slug: string;
      name: string;
      type: string;
      tier: number;
      date_start: number | null;
      date_start_precision: string | null;
      similarity: number;
    };
    const rows = await db.execute<SimRow>(sql`
      WITH seed AS (
        SELECT embedding FROM entities WHERE qid = ${entity.qid}
      )
      SELECT
        e.qid, e.slug, e.name, e.type, e.tier,
        e.date_start, e.date_start_precision,
        1 - (e.embedding <=> seed.embedding) AS similarity
      FROM entities e, seed
      WHERE e.embedding IS NOT NULL AND e.qid <> ${entity.qid}
      ORDER BY e.embedding <=> seed.embedding
      LIMIT 20
    `);
    similar = Array.from(rows)
      .filter((r) => !dedupQids.has(r.qid))
      .slice(0, 6)
      .map((r) => ({
        qid: r.qid,
        slug: r.slug,
        name: r.name,
        type: r.type,
        tier: r.tier,
        dateStart: r.date_start,
        dateStartPrecision: r.date_start_precision,
        similarity: r.similarity,
      }));
  }

  return {
    entity,
    aliases: aliasRows,
    related: related.slice(0, RELATED_CAP),
    orphanTargets: orphanTargets.slice(0, 12),
    sources: srcRows,
    media: mediaRows,
    regionPeers,
    primaryTag,
    similar,
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

export interface FeaturedEntity {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  dateEnd: number | null;
  summary: string | null;
  civTags: string[];
  primaryTag: string | null;
  era: string;
}

type FeaturedRow = {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  date_start: number | null;
  date_end: number | null;
  summary: string | null;
  civ_tags: string[];
} & Record<string, unknown>;

// eraFor: imported from lib/format below.

/**
 * Featured rotation: round-robin pick from civilizational tags so no
 * region appears more than `maxPerRegion` times. Prefer higher-tier
 * entities within each region. Returns ~`count` items.
 */
export async function getFeaturedEntities(
  count = 12,
  maxPerRegion = 2,
): Promise<FeaturedEntity[]> {
  const rows = await db.execute<FeaturedRow>(sql`
    SELECT
      e.qid,
      e.slug,
      e.name,
      e.type,
      e.tier,
      e.date_start,
      e.date_end,
      e.summary,
      COALESCE(
        ARRAY_AGG(er.region_value) FILTER (WHERE er.region_kind = 'civilizational'),
        ARRAY[]::varchar[]
      ) AS civ_tags
    FROM entities e
    LEFT JOIN entity_regions er ON er.entity_qid = e.qid
    WHERE e.tier >= 1
    GROUP BY e.qid
  `);

  // Group by primary tag (first civ tag); fallback bucket for untagged.
  const buckets = new Map<string, FeaturedEntity[]>();
  for (const r of Array.from(rows)) {
    const tags = r.civ_tags ?? [];
    const primary = tags[0] ?? "uncategorised";
    const e: FeaturedEntity = {
      qid: r.qid,
      slug: r.slug,
      name: r.name,
      type: r.type,
      tier: r.tier,
      dateStart: r.date_start,
      dateEnd: r.date_end,
      summary: r.summary,
      civTags: tags,
      primaryTag: tags[0] ?? null,
      era: eraFor(r.date_start),
    };
    const arr = buckets.get(primary);
    if (arr) arr.push(e);
    else buckets.set(primary, [e]);
  }
  // Within each bucket: higher tier first, then alphabetical
  for (const arr of buckets.values()) {
    arr.sort(
      (a, b) => b.tier - a.tier || a.name.localeCompare(b.name),
    );
  }
  // Order buckets by size desc (so biggest civilizations contribute first)
  // then alphabetical bucket name for stable ordering.
  const bucketKeys = [...buckets.keys()].sort((a, b) => {
    const sizeDiff = (buckets.get(b)?.length ?? 0) - (buckets.get(a)?.length ?? 0);
    return sizeDiff !== 0 ? sizeDiff : a.localeCompare(b);
  });

  const featured: FeaturedEntity[] = [];
  const seenPerRegion = new Map<string, number>();
  let exhausted = false;
  let pass = 0;
  while (featured.length < count && !exhausted) {
    exhausted = true;
    for (const tag of bucketKeys) {
      if (featured.length >= count) break;
      const arr = buckets.get(tag);
      if (!arr || pass >= arr.length) continue;
      const used = seenPerRegion.get(tag) ?? 0;
      if (used >= maxPerRegion) continue;
      const candidate = arr[pass]!;
      featured.push(candidate);
      seenPerRegion.set(tag, used + 1);
      exhausted = false;
    }
    pass += 1;
  }
  return featured;
}
