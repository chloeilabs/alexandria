-- Phase 1: per-claim factuality via semantic entropy.
-- Hand-written (like 0001) because the repo applies migrations directly with
-- psql; drizzle-kit's journal is reserved for the initial snapshot.

-- 1. Async per-claim factuality summary on entities. Null until scored.
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS claim_factuality_score real,
  ADD COLUMN IF NOT EXISTS claims_scored_at timestamptz;

-- 2. entity_claims — atomic claims decomposed from the narrative, each with a
--    semantic-entropy score from sampling the generator on the bare question.
CREATE TABLE IF NOT EXISTS entity_claims (
  id                bigserial PRIMARY KEY,
  entity_id         uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  claim             text NOT NULL,
  question          text NOT NULL,
  n_samples         smallint NOT NULL DEFAULT 0,
  distinct_answers  smallint NOT NULL DEFAULT 0,
  entropy           real NOT NULL DEFAULT 0,
  verdict           varchar(16) NOT NULL DEFAULT 'uncertain',
  majority_answer   text,
  agrees_with_claim boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_claims_entity_idx ON entity_claims (entity_id);
CREATE INDEX IF NOT EXISTS entity_claims_verdict_idx ON entity_claims (verdict);
