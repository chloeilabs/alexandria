CREATE TABLE "fact_check_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_qid" varchar(32) NOT NULL,
	"model" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"flagged_claims" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fact_check_reviews" ADD CONSTRAINT "fact_check_reviews_entity_qid_entities_qid_fk" FOREIGN KEY ("entity_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fact_check_reviews_entity_idx" ON "fact_check_reviews" USING btree ("entity_qid");--> statement-breakpoint
CREATE INDEX "fact_check_reviews_status_idx" ON "fact_check_reviews" USING btree ("status");