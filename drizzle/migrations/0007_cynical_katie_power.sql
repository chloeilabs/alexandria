ALTER TABLE "entities" ADD COLUMN "enwiki_title" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "sitelink_count" integer DEFAULT 0 NOT NULL;