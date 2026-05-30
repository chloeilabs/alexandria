-- External grounding: resolve LLM-claimed citations against CrossRef/OpenAlex.
-- Hand-written (like 0001/0002); applied directly with psql.

ALTER TABLE entity_claimed_citations
  ADD COLUMN IF NOT EXISTS resolution_status   varchar(16) NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS resolved_title      text,
  ADD COLUMN IF NOT EXISTS resolved_doi        text,
  ADD COLUMN IF NOT EXISTS resolved_url        text,
  ADD COLUMN IF NOT EXISTS resolution_confidence real,
  ADD COLUMN IF NOT EXISTS resolved_via        varchar(16),
  ADD COLUMN IF NOT EXISTS resolved_at         timestamptz;

CREATE INDEX IF NOT EXISTS entity_citations_resolution_idx
  ON entity_claimed_citations (resolution_status);
