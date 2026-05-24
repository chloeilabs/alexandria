CREATE TABLE "enrichment_priority" (
	"id" serial PRIMARY KEY NOT NULL,
	"civilizational_tag" varchar(64) NOT NULL,
	"qid" varchar(32) NOT NULL,
	"deficit_score" integer NOT NULL,
	"rank_in_bucket" integer NOT NULL,
	"target_tier" smallint NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "media_commons_url_unique";--> statement-breakpoint
ALTER TABLE "enrichment_priority" ADD CONSTRAINT "enrichment_priority_qid_entities_qid_fk" FOREIGN KEY ("qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrichment_priority_civ_idx" ON "enrichment_priority" USING btree ("civilizational_tag");--> statement-breakpoint
CREATE INDEX "enrichment_priority_target_idx" ON "enrichment_priority" USING btree ("target_tier");--> statement-breakpoint
CREATE INDEX "enrichment_priority_deficit_idx" ON "enrichment_priority" USING btree ("deficit_score");--> statement-breakpoint
CREATE UNIQUE INDEX "enrichment_priority_unique" ON "enrichment_priority" USING btree ("civilizational_tag","qid","target_tier");--> statement-breakpoint
CREATE UNIQUE INDEX "media_entity_commons_unique" ON "media" USING btree ("entity_qid","commons_url");