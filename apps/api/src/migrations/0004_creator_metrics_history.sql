CREATE TABLE IF NOT EXISTS creator_metrics_history (
  id text PRIMARY KEY,
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  source text NOT NULL,
  "window" integer NOT NULL,
  fetched_at timestamptz NOT NULL,
  job_id text,
  metrics jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS creator_metrics_history_creator_fetched_idx
  ON creator_metrics_history (creator_id, fetched_at DESC);
