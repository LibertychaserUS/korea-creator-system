ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS cursor text;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS pages_done integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS quota_used integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS next_run_at timestamptz;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS max_pages integer NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS ingest_source_usage (
  source text NOT NULL,
  day date NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  PRIMARY KEY (source, day)
);

CREATE INDEX IF NOT EXISTS ingest_jobs_queue_idx
  ON ingest_jobs (status, next_run_at, created_at);
