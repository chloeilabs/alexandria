-- Indexes drizzle-kit can't express: pgvector HNSW, GIN tsvector, GIN trigram.
-- Also derive the search_text tsvector via a generated column trigger so
-- queries don't have to recompute on every read.

-- 1. tsvector backing for entities.search_text. Materialize via trigger
--    so it stays in sync with canonical_name + summary.
CREATE OR REPLACE FUNCTION entities_search_text_refresh() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_text :=
    setweight(to_tsvector('english', coalesce(NEW.canonical_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'C');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS entities_search_text_trigger ON entities;
CREATE TRIGGER entities_search_text_trigger
BEFORE INSERT OR UPDATE OF canonical_name, short_description, summary
ON entities
FOR EACH ROW EXECUTE FUNCTION entities_search_text_refresh();

-- 2. GIN index on the materialized tsvector.
CREATE INDEX IF NOT EXISTS entities_search_text_gin
  ON entities USING gin (search_text);

-- 3. HNSW vector index. m=16, ef_construction=64 is the pgvector default
--    sweet spot for ~10k–1M rows.
CREATE INDEX IF NOT EXISTS entities_embedding_hnsw
  ON entities USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Trigram index on aliases for fuzzy name lookup.
CREATE INDEX IF NOT EXISTS entity_aliases_alias_trgm
  ON entity_aliases USING gin (alias gin_trgm_ops);

-- 5. Trigram on entity canonical_name for "did you mean" fallback.
CREATE INDEX IF NOT EXISTS entities_canonical_trgm
  ON entities USING gin (canonical_name gin_trgm_ops);
