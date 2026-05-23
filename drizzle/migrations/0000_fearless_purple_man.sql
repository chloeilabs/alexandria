CREATE TABLE "civilizational_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"parent_id" integer,
	CONSTRAINT "civilizational_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"qid" varchar(32) PRIMARY KEY NOT NULL,
	"slug" "citext" NOT NULL,
	"name" text NOT NULL,
	"type" varchar(24) NOT NULL,
	"tier" smallint DEFAULT 0 NOT NULL,
	"date_start" integer,
	"date_start_precision" varchar(16),
	"date_end" integer,
	"date_end_precision" varchar(16),
	"latitude" real,
	"longitude" real,
	"summary" text,
	"narrative" text,
	"source_attribution" jsonb,
	"embedding" vector(1024),
	"search_text" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("entities"."name", '') || ' ' || coalesce("entities"."summary", ''))) STORED,
	"inbound_link_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tier_upgraded_at" timestamp with time zone,
	CONSTRAINT "entities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_qid" varchar(32) NOT NULL,
	"alias" "citext" NOT NULL,
	"language" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_qid" varchar(32) NOT NULL,
	"region_kind" varchar(24) NOT NULL,
	"region_value" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_qid" varchar(32) NOT NULL,
	"commons_url" text NOT NULL,
	"local_path" text,
	"kind" varchar(24) NOT NULL,
	"license" varchar(64) NOT NULL,
	"attribution" text NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_checkpoints" (
	"kind" varchar(48) PRIMARY KEY NOT NULL,
	"last_processed_qid" varchar(32),
	"byte_offset" bigint,
	"entities_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_kind" varchar(48) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"entities_processed" integer DEFAULT 0 NOT NULL,
	"api_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"status" varchar(24) DEFAULT 'running' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_qid" varchar(32) NOT NULL,
	"target_qid" varchar(32) NOT NULL,
	"predicate" varchar(16) NOT NULL,
	"qualifiers" jsonb
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_qid" varchar(32) NOT NULL,
	"source_kind" varchar(32) NOT NULL,
	"url" text,
	"content" text NOT NULL,
	"license" varchar(64) NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "un_subregions" (
	"code" varchar(8) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region_code" varchar(8) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_qid_entities_qid_fk" FOREIGN KEY ("entity_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_regions" ADD CONSTRAINT "entity_regions_entity_qid_entities_qid_fk" FOREIGN KEY ("entity_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_entity_qid_entities_qid_fk" FOREIGN KEY ("entity_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_qid_entities_qid_fk" FOREIGN KEY ("source_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_qid_entities_qid_fk" FOREIGN KEY ("target_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_entity_qid_entities_qid_fk" FOREIGN KEY ("entity_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_type_idx" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "entities_date_start_idx" ON "entities" USING btree ("date_start");--> statement-breakpoint
CREATE INDEX "entities_tier_idx" ON "entities" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "entities_inbound_links_idx" ON "entities" USING btree ("inbound_link_count");--> statement-breakpoint
CREATE INDEX "entities_search_text_idx" ON "entities" USING gin ("search_text");--> statement-breakpoint
CREATE INDEX "entity_aliases_entity_idx" ON "entity_aliases" USING btree ("entity_qid");--> statement-breakpoint
CREATE INDEX "entity_aliases_alias_idx" ON "entity_aliases" USING btree ("alias");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_aliases_unique" ON "entity_aliases" USING btree ("entity_qid","alias","language");--> statement-breakpoint
CREATE INDEX "entity_regions_lookup_idx" ON "entity_regions" USING btree ("region_kind","region_value");--> statement-breakpoint
CREATE INDEX "entity_regions_entity_idx" ON "entity_regions" USING btree ("entity_qid");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_regions_unique" ON "entity_regions" USING btree ("entity_qid","region_kind","region_value");--> statement-breakpoint
CREATE INDEX "media_entity_idx" ON "media" USING btree ("entity_qid");--> statement-breakpoint
CREATE UNIQUE INDEX "media_commons_url_unique" ON "media" USING btree ("commons_url");--> statement-breakpoint
CREATE INDEX "pipeline_runs_started_idx" ON "pipeline_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "relationships_source_idx" ON "relationships" USING btree ("source_qid");--> statement-breakpoint
CREATE INDEX "relationships_target_idx" ON "relationships" USING btree ("target_qid");--> statement-breakpoint
CREATE INDEX "relationships_predicate_idx" ON "relationships" USING btree ("predicate");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_unique" ON "relationships" USING btree ("source_qid","target_qid","predicate");--> statement-breakpoint
CREATE INDEX "sources_entity_idx" ON "sources" USING btree ("entity_qid");--> statement-breakpoint
CREATE INDEX "sources_kind_idx" ON "sources" USING btree ("source_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_entity_kind_unique" ON "sources" USING btree ("entity_qid","source_kind");