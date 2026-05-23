CREATE TABLE "thread_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"entity_qid" varchar(32) NOT NULL,
	"position" integer NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"blurb" text,
	"intro" text,
	"featured" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "thread_entries" ADD CONSTRAINT "thread_entries_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_entries" ADD CONSTRAINT "thread_entries_entity_qid_entities_qid_fk" FOREIGN KEY ("entity_qid") REFERENCES "public"."entities"("qid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "thread_entries_thread_idx" ON "thread_entries" USING btree ("thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_entries_position_unique" ON "thread_entries" USING btree ("thread_id","position");--> statement-breakpoint
CREATE INDEX "threads_featured_idx" ON "threads" USING btree ("featured");