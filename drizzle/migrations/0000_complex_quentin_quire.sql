CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"canonical_name" text NOT NULL,
	"disambiguator" text,
	"entity_type" varchar(24) NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"short_description" text NOT NULL,
	"summary" text NOT NULL,
	"narrative" text NOT NULL,
	"structured_facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"key_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coords" jsonb,
	"generator_model" varchar(64) NOT NULL,
	"verifier_model" varchar(64),
	"consensus_score" real DEFAULT 0 NOT NULL,
	"disagreement_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding" vector(1024),
	"search_text" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"alias" "citext" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_claimed_citations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"claim_excerpt" text NOT NULL,
	"claimed_source" text NOT NULL,
	"claimed_url" text,
	"claimed_author" text,
	"claim_kind" varchar(16) DEFAULT 'other' NOT NULL,
	"verified_by_second_model" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relationships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"predicate" varchar(64) NOT NULL,
	"qualifiers" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_topics" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"topic" "citext" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_rotation" (
	"date" date PRIMARY KEY NOT NULL,
	"entity_ids" uuid[] NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" uuid,
	"seed_topic_id" integer,
	"job_kind" varchar(24) NOT NULL,
	"model" varchar(64) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"api_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"status" varchar(24) DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" varchar(64) NOT NULL,
	"severity" smallint DEFAULT 1 NOT NULL,
	"disagreement_jsonb" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolution" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "seed_topics" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hint" text,
	"entity_type_guess" varchar(24),
	"priority" smallint DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"batch_label" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_claimed_citations" ADD CONSTRAINT "entity_claimed_citations_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_target_id_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_topics" ADD CONSTRAINT "entity_topics_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entities_slug_unique" ON "entities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "entities_type_idx" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entities_status_idx" ON "entities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entities_published_idx" ON "entities" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_aliases_unique" ON "entity_aliases" USING btree ("entity_id","alias");--> statement-breakpoint
CREATE INDEX "entity_citations_entity_idx" ON "entity_claimed_citations" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_rel_unique" ON "entity_relationships" USING btree ("source_id","target_id","predicate");--> statement-breakpoint
CREATE INDEX "entity_rel_target_idx" ON "entity_relationships" USING btree ("target_id","predicate");--> statement-breakpoint
CREATE INDEX "entity_rel_source_idx" ON "entity_relationships" USING btree ("source_id","predicate");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_topics_unique" ON "entity_topics" USING btree ("entity_id","topic");--> statement-breakpoint
CREATE INDEX "entity_topics_topic_idx" ON "entity_topics" USING btree ("topic");