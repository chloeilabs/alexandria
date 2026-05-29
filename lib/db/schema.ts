// Drizzle schema for the AI-distilled knowledge base.
//
// The corpus is heterogeneous (person, place, event, concept, …) so the
// shape is one wide table with type-tagged rows, plus side tables for
// 1-to-N data (aliases, relationships, citations, topics) and pipeline
// bookkeeping (generation_runs, review_queue, seed_topics,
// featured_rotation).
//
// Extensions installed by scripts/init-db.sql: vector, pg_trgm, citext.

import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------
// Custom types (pgvector + citext + tsvector + uuid[])
// ---------------------------------------------------------------------

const vector = (name: string, dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value) {
      return JSON.parse(value as string);
    },
  })(name);

const citext = (name: string) =>
  customType<{ data: string }>({
    dataType() {
      return "citext";
    },
  })(name);

const tsvector = (name: string) =>
  customType<{ data: string }>({
    dataType() {
      return "tsvector";
    },
  })(name);

const uuidArray = (name: string) =>
  customType<{ data: string[]; driverData: string }>({
    dataType() {
      return "uuid[]";
    },
    toDriver(value) {
      return `{${value.join(",")}}`;
    },
  })(name);

// ---------------------------------------------------------------------
// Enums kept as varchar (looser than pg enums; extend without ALTER TYPE)
// ---------------------------------------------------------------------

export const ENTITY_TYPES = [
  "person",
  "place",
  "event",
  "concept",
  "work",
  "organization",
  "species",
  "artifact",
  "other",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_STATUSES = [
  "draft",
  "verified",
  "flagged",
  "published",
] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

// ---------------------------------------------------------------------
// entities — heterogeneous entries, AI-synthesized
// ---------------------------------------------------------------------

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").notNull(),
    canonicalName: text("canonical_name").notNull(),
    disambiguator: text("disambiguator"),
    entityType: varchar("entity_type", { length: 24 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("draft"),

    shortDescription: text("short_description").notNull(),
    summary: text("summary").notNull(),
    narrative: text("narrative").notNull(),
    structuredFacts: jsonb("structured_facts").notNull().default({}),
    keyDates: jsonb("key_dates").notNull().default([]),
    coords: jsonb("coords"),

    generatorModel: varchar("generator_model", { length: 64 }).notNull(),
    verifierModel: varchar("verifier_model", { length: 64 }),
    consensusScore: real("consensus_score").notNull().default(0),
    disagreementNotes: jsonb("disagreement_notes").notNull().default([]),

    // Per-claim factuality (semantic-entropy enrichment, scored async after
    // generation). Null until scripts/score-claims.ts has run for the entity.
    claimFactualityScore: real("claim_factuality_score"),
    claimsScoredAt: timestamp("claims_scored_at", { withTimezone: true }),

    embedding: vector("embedding", 1024),
    searchText: tsvector("search_text"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("entities_slug_unique").on(t.slug),
    index("entities_type_idx").on(t.entityType),
    index("entities_status_idx").on(t.status),
    index("entities_published_idx").on(t.publishedAt),
  ],
);

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

// ---------------------------------------------------------------------
// entity_aliases
// ---------------------------------------------------------------------

export const entityAliases = pgTable(
  "entity_aliases",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    alias: citext("alias").notNull(),
  },
  (t) => [uniqueIndex("entity_aliases_unique").on(t.entityId, t.alias)],
);

// ---------------------------------------------------------------------
// entity_relationships
// ---------------------------------------------------------------------

export const entityRelationships = pgTable(
  "entity_relationships",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    predicate: varchar("predicate", { length: 64 }).notNull(),
    qualifiers: jsonb("qualifiers").notNull().default({}),
  },
  (t) => [
    uniqueIndex("entity_rel_unique").on(t.sourceId, t.targetId, t.predicate),
    index("entity_rel_target_idx").on(t.targetId, t.predicate),
    index("entity_rel_source_idx").on(t.sourceId, t.predicate),
  ],
);

// ---------------------------------------------------------------------
// entity_claimed_citations — LLM-claimed, NOT externally verified
// ---------------------------------------------------------------------

export const entityClaimedCitations = pgTable(
  "entity_claimed_citations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    claimExcerpt: text("claim_excerpt").notNull(),
    claimedSource: text("claimed_source").notNull(),
    claimedUrl: text("claimed_url"),
    claimedAuthor: text("claimed_author"),
    claimKind: varchar("claim_kind", { length: 16 }).notNull().default("other"),
    verifiedBySecondModel: boolean("verified_by_second_model")
      .notNull()
      .default(false),
  },
  (t) => [index("entity_citations_entity_idx").on(t.entityId)],
);

// ---------------------------------------------------------------------
// entity_topics — flat, free-form tag clusters
// ---------------------------------------------------------------------

export const entityTopics = pgTable(
  "entity_topics",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    topic: citext("topic").notNull(),
  },
  (t) => [
    uniqueIndex("entity_topics_unique").on(t.entityId, t.topic),
    index("entity_topics_topic_idx").on(t.topic),
  ],
);

// ---------------------------------------------------------------------
// entity_claims — atomic claims decomposed from the narrative, each scored
// by semantic entropy (Farquhar et al., Nature 2024). The verifier samples
// the generator N times on the bare question; scattered answers = high
// entropy = likely confabulation. This is per-claim factuality, distinct
// from the holistic consensus_score on entities.
// ---------------------------------------------------------------------

export const CLAIM_VERDICTS = [
  "corroborated",
  "uncertain",
  "contradicted",
] as const;
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number];

export const entityClaims = pgTable(
  "entity_claims",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    claim: text("claim").notNull(),
    question: text("question").notNull(),
    nSamples: smallint("n_samples").notNull().default(0),
    distinctAnswers: smallint("distinct_answers").notNull().default(0),
    entropy: real("entropy").notNull().default(0),
    verdict: varchar("verdict", { length: 16 }).notNull().default("uncertain"),
    majorityAnswer: text("majority_answer"),
    agreesWithClaim: boolean("agrees_with_claim").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("entity_claims_entity_idx").on(t.entityId),
    index("entity_claims_verdict_idx").on(t.verdict),
  ],
);

export type EntityClaim = typeof entityClaims.$inferSelect;

// ---------------------------------------------------------------------
// generation_runs — pipeline bookkeeping; budget cap reads from this
// ---------------------------------------------------------------------

export const generationRuns = pgTable("generation_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityId: uuid("entity_id").references(() => entities.id, {
    onDelete: "set null",
  }),
  seedTopicId: integer("seed_topic_id"),
  jobKind: varchar("job_kind", { length: 24 }).notNull(),
  model: varchar("model", { length: 64 }).notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  apiCostUsd: numeric("api_cost_usd", { precision: 12, scale: 6 })
    .notNull()
    .default("0"),
  status: varchar("status", { length: 24 }).notNull().default("running"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type GenerationRun = typeof generationRuns.$inferSelect;

// ---------------------------------------------------------------------
// review_queue — flagged-for-human-review items
// ---------------------------------------------------------------------

export const reviewQueue = pgTable("review_queue", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 64 }).notNull(),
  severity: smallint("severity").notNull().default(1),
  disagreementJsonb: jsonb("disagreement_jsonb").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: text("resolved_by"),
  resolution: varchar("resolution", { length: 32 }),
});

// ---------------------------------------------------------------------
// seed_topics — the corpus universe (editor's queue)
// ---------------------------------------------------------------------

export const seedTopics = pgTable("seed_topics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  hint: text("hint"),
  entityTypeGuess: varchar("entity_type_guess", { length: 24 }),
  priority: smallint("priority").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  batchLabel: varchar("batch_label", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------
// featured_rotation — cached daily featured set
// ---------------------------------------------------------------------

export const featuredRotation = pgTable("featured_rotation", {
  date: date("date").primaryKey(),
  entityIds: uuidArray("entity_ids").notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// HNSW + GIN indexes that drizzle-kit can't express are applied in
// drizzle/migrations/0001_indexes.sql.

export { sql };
