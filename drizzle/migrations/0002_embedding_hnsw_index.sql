-- HNSW index on entities.embedding for fast cosine ANN search.
--
-- Built post-seed (per DECISIONS.md): IVFFLAT during bulk insert, HNSW
-- once the corpus is stable enough that index build time is acceptable.
-- At our current ~200 entities, build is sub-second. With m=16 and
-- ef_construction=64 the recall is >95% and the index fits comfortably
-- in memory.

CREATE INDEX IF NOT EXISTS "entities_embedding_idx"
  ON "entities" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
