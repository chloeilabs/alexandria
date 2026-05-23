-- Extensions required by the Library of Alexandria.
-- This script runs once on first container startup via the Postgres
-- docker-entrypoint-initdb.d hook. Subsequent restarts are no-ops because
-- of CREATE EXTENSION IF NOT EXISTS guards.

-- pgvector: vector(N) columns and HNSW/IVFFLAT indexes for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm: trigram similarity for fuzzy alias matching during ingestion
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- citext: case-insensitive text type for aliases and slugs
CREATE EXTENSION IF NOT EXISTS citext;
