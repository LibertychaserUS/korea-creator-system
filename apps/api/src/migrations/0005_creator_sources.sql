CREATE TABLE IF NOT EXISTS creator_sources (
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, external_id)
);

CREATE INDEX IF NOT EXISTS creator_sources_creator_idx
  ON creator_sources (creator_id, last_seen_at DESC);

INSERT INTO creator_sources
  (creator_id, source, external_id, first_seen_at, last_seen_at)
SELECT id, source, external_id, created_at, COALESCE(metrics_fetched_at, updated_at)
FROM creators
WHERE source IS NOT NULL AND external_id IS NOT NULL
ON CONFLICT (source, external_id) DO UPDATE SET
  creator_id = EXCLUDED.creator_id,
  last_seen_at = GREATEST(creator_sources.last_seen_at, EXCLUDED.last_seen_at);
