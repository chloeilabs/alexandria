import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Custom types
// ---------------------------------------------------------------------------

// citext: case-insensitive text. Postgres extension enabled in init-db.sql.
const citext = customType<{ data: string; notNull: true }>({
  dataType() {
    return "citext";
  },
});

// tsvector: generated full-text search column. Indexed with GIN below.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ---------------------------------------------------------------------------
// Core: entities
// ---------------------------------------------------------------------------

export const entities = pgTable(
  "entities",
  {
    // Wikidata QID is the canonical key. URL slug is derived but separate.
    qid: varchar("qid", { length: 32 }).primaryKey(),
    slug: citext("slug").notNull().unique(),
    name: text("name").notNull(),
    // person | place | event | organization | work | concept
    type: varchar("type", { length: 24 }).notNull(),
    // 0 = stub, 1 = summary, 2 = narrative, 3 = curated
    tier: smallint("tier").notNull().default(0),

    // Dates: year integer (negative = BCE). Precision distinguishes
    // "exact year" from "decade" / "century" / "millennium" for rendering.
    dateStart: integer("date_start"),
    dateStartPrecision: varchar("date_start_precision", { length: 16 }),
    dateEnd: integer("date_end"),
    dateEndPrecision: varchar("date_end_precision", { length: 16 }),

    // Geography: plain float4/real columns. MapLibre handles rendering — we
    // don't need PostGIS for the queries we run. See DECISIONS.md.
    latitude: real("latitude"),
    longitude: real("longitude"),

    // Tiered content
    summary: text("summary"), // Tier 1+
    narrative: text("narrative"), // Tier 2+
    sourceAttribution: jsonb("source_attribution"), // Array<{kind, url, license}>

    // Search
    embedding: vector("embedding", { dimensions: 1024 }),
    searchText: tsvector("search_text").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(${entities.name}, '') || ' ' || coalesce(${entities.summary}, ''))`,
    ),

    // Priority signals for the pg-boss upgrade queue
    inboundLinkCount: integer("inbound_link_count").notNull().default(0),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    tierUpgradedAt: timestamp("tier_upgraded_at", { withTimezone: true }),
  },
  (t) => [
    index("entities_type_idx").on(t.type),
    index("entities_date_start_idx").on(t.dateStart),
    index("entities_tier_idx").on(t.tier),
    index("entities_inbound_links_idx").on(t.inboundLinkCount),
    index("entities_search_text_idx").using("gin", t.searchText),
    // Embedding index is built in a manual follow-up migration after seed:
    // CREATE INDEX entities_embedding_idx ON entities USING hnsw
    //   (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
    // During seed we use IVFFLAT for fast inserts. See DECISIONS.md.
  ],
);

// ---------------------------------------------------------------------------
// Aliases — multilingual labels for search and disambiguation
// ---------------------------------------------------------------------------

export const entityAliases = pgTable(
  "entity_aliases",
  {
    id: serial("id").primaryKey(),
    entityQid: varchar("entity_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    alias: citext("alias").notNull(),
    language: varchar("language", { length: 16 }).notNull(),
  },
  (t) => [
    index("entity_aliases_entity_idx").on(t.entityQid),
    index("entity_aliases_alias_idx").on(t.alias),
    uniqueIndex("entity_aliases_unique").on(t.entityQid, t.alias, t.language),
  ],
);

// ---------------------------------------------------------------------------
// Regions — hybrid taxonomy: UN subregion + civilizational tag + era_region
// ---------------------------------------------------------------------------

export const entityRegions = pgTable(
  "entity_regions",
  {
    id: serial("id").primaryKey(),
    entityQid: varchar("entity_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    // un_subregion | civilizational | era_region
    regionKind: varchar("region_kind", { length: 24 }).notNull(),
    regionValue: varchar("region_value", { length: 64 }).notNull(),
  },
  (t) => [
    index("entity_regions_lookup_idx").on(t.regionKind, t.regionValue),
    index("entity_regions_entity_idx").on(t.entityQid),
    uniqueIndex("entity_regions_unique").on(
      t.entityQid,
      t.regionKind,
      t.regionValue,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relationships — the connection graph
// ---------------------------------------------------------------------------

export const relationships = pgTable(
  "relationships",
  {
    id: serial("id").primaryKey(),
    sourceQid: varchar("source_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    // No FK on target_qid: during bulk seed, the target entity may not have
    // been ingested yet (or may have been filtered out by the seed filter).
    // Orphan relationships are tolerated; a periodic worker cleans them up.
    targetQid: varchar("target_qid", { length: 32 }).notNull(),
    // Wikidata property: P22 (father), P39 (position-held), P361 (part-of), ...
    predicate: varchar("predicate", { length: 16 }).notNull(),
    // Time-bounded relationships and other qualifiers
    qualifiers: jsonb("qualifiers"),
  },
  (t) => [
    index("relationships_source_idx").on(t.sourceQid),
    index("relationships_target_idx").on(t.targetQid),
    index("relationships_predicate_idx").on(t.predicate),
    uniqueIndex("relationships_unique").on(
      t.sourceQid,
      t.targetQid,
      t.predicate,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Media — public-domain only, cached locally
// ---------------------------------------------------------------------------

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    entityQid: varchar("entity_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    commonsUrl: text("commons_url").notNull(),
    localPath: text("local_path"),
    // image | map | document | audio
    kind: varchar("kind", { length: 24 }).notNull(),
    license: varchar("license", { length: 64 }).notNull(),
    attribution: text("attribution").notNull(),
    caption: text("caption"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("media_entity_idx").on(t.entityQid),
    uniqueIndex("media_commons_url_unique").on(t.commonsUrl),
  ],
);

// ---------------------------------------------------------------------------
// Sources — raw source text used to generate Tier 1+ narratives
// ---------------------------------------------------------------------------

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    entityQid: varchar("entity_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    // wikipedia | britannica_1911 | sep | own | ...
    sourceKind: varchar("source_kind", { length: 32 }).notNull(),
    url: text("url"),
    content: text("content").notNull(),
    license: varchar("license", { length: 64 }).notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sources_entity_idx").on(t.entityQid),
    index("sources_kind_idx").on(t.sourceKind),
    uniqueIndex("sources_entity_kind_unique").on(t.entityQid, t.sourceKind),
  ],
);

// ---------------------------------------------------------------------------
// Pipeline runs — every API call accumulates cost here for the daily cap
// ---------------------------------------------------------------------------

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: serial("id").primaryKey(),
    jobKind: varchar("job_kind", { length: 48 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    entitiesProcessed: integer("entities_processed").notNull().default(0),
    apiCostUsd: numeric("api_cost_usd", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    // running | completed | failed | budget_exceeded
    status: varchar("status", { length: 24 }).notNull().default("running"),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("pipeline_runs_started_idx").on(t.startedAt),
    index("pipeline_runs_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Pipeline checkpoints — resume bulk dumps after crash
// ---------------------------------------------------------------------------

export const pipelineCheckpoints = pgTable("pipeline_checkpoints", {
  // wikidata_dump | wikipedia_dump | civilization_tagging | ...
  kind: varchar("kind", { length: 48 }).primaryKey(),
  lastProcessedQid: varchar("last_processed_qid", { length: 32 }),
  byteOffset: bigint("byte_offset", { mode: "bigint" }),
  entitiesCount: integer("entities_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Region taxonomy — configuration tables
// ---------------------------------------------------------------------------

export const civilizationalTags = pgTable("civilizational_tags", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
});

export const unSubregions = pgTable("un_subregions", {
  // UN M.49 code (e.g., "017" Middle Africa, "143" Central Asia)
  code: varchar("code", { length: 8 }).primaryKey(),
  name: text("name").notNull(),
  // Containing UN region code (e.g., "002" Africa)
  regionCode: varchar("region_code", { length: 8 }).notNull(),
});

// ---------------------------------------------------------------------------
// Threads — curated paths through 5-10 entities. Editorial layer.
// ---------------------------------------------------------------------------

export const threads = pgTable(
  "threads",
  {
    id: serial("id").primaryKey(),
    slug: citext("slug").notNull().unique(),
    title: text("title").notNull(),
    /** One-line subtitle shown in lists. */
    blurb: text("blurb"),
    /** Long-form intro paragraph rendered above the entity sequence. */
    intro: text("intro"),
    /** Featured = surfaced on the homepage. At most one at a time. */
    featured: integer("featured").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("threads_featured_idx").on(t.featured)],
);

export const threadEntries = pgTable(
  "thread_entries",
  {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    entityQid: varchar("entity_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    /** Position in the thread (0-indexed). */
    position: integer("position").notNull(),
    /** Optional editorial note bridging from the previous entry to this one. */
    note: text("note"),
  },
  (t) => [
    index("thread_entries_thread_idx").on(t.threadId),
    uniqueIndex("thread_entries_position_unique").on(t.threadId, t.position),
  ],
);

// ---------------------------------------------------------------------------
// Fact-check reviews — the plan's "tier_2_review" surface.
// ---------------------------------------------------------------------------
//
// One row per (entity × model × run). A fresh fact-check supersedes the
// previous one; we keep history for audit but the entity page reads the
// most recent.

export const factCheckReviews = pgTable(
  "fact_check_reviews",
  {
    id: serial("id").primaryKey(),
    entityQid: varchar("entity_qid", { length: 32 })
      .notNull()
      .references(() => entities.qid, { onDelete: "cascade" }),
    /** "google/gemini-3.5-flash" etc. */
    model: varchar("model", { length: 64 }).notNull(),
    /** "clean" = no findings; "flagged" = findings present; "failed" = error. */
    status: varchar("status", { length: 16 }).notNull(),
    /** [{claim, reason, source_excerpt?}] — see lib/ai/prompts/fact-check.ts */
    flaggedClaims: jsonb("flagged_claims"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("fact_check_reviews_entity_idx").on(t.entityQid),
    index("fact_check_reviews_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Featured cache — pre-computed homepage rotation, refreshed by Vercel cron.
// ---------------------------------------------------------------------------
//
// A single-row table (we only ever care about the latest). The Vercel cron
// endpoint at /api/cron/refresh-featured replaces this row with a fresh
// featured set; getFeaturedEntities reads it back. Falls back to live
// compute if the cache is missing or older than 36h.

export const featuredCache = pgTable("featured_cache", {
  id: serial("id").primaryKey(),
  /** Array of FeaturedEntity objects — see lib/db/queries/entity.ts */
  entities: jsonb("entities").notNull(),
  /** Inputs used to generate this rotation, for debugging. */
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Type exports for application code
// ---------------------------------------------------------------------------

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
export type Media = typeof media.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type PipelineCheckpoint = typeof pipelineCheckpoints.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type ThreadEntry = typeof threadEntries.$inferSelect;
export type NewThreadEntry = typeof threadEntries.$inferInsert;
export type FactCheckReview = typeof factCheckReviews.$inferSelect;
export type NewFactCheckReview = typeof factCheckReviews.$inferInsert;
export type FeaturedCache = typeof featuredCache.$inferSelect;
export type NewFeaturedCache = typeof featuredCache.$inferInsert;
