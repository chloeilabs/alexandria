CREATE TABLE "featured_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"entities" jsonb NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
