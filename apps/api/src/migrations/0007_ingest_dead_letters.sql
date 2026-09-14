-- One drainer, one job at a time: the claim writes a lease so a crashed worker's
-- job is only re-taken after the lease expires, never in parallel with it.
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

-- Nothing that failed is thrown away. `kind = 'job'` parks the run's parameters
-- and cursor so a replay continues where it stopped; `kind = 'record'` parks the
-- untouched vendor payload of a single creator we could not read or write.
CREATE TABLE IF NOT EXISTS ingest_dead_letters (
  id text PRIMARY KEY,
  kind text NOT NULL,
  state text NOT NULL DEFAULT 'open',
  source text NOT NULL,
  job_id text REFERENCES ingest_jobs(id) ON DELETE SET NULL,
  external_id text,
  code text NOT NULL,
  message text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  replay_count integer NOT NULL DEFAULT 0,
  query jsonb,
  cursor text,
  payload jsonb,
  replay_job_id text,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One open record dead letter per (source, creator): a payload that keeps failing
-- updates its entry instead of piling up copies.
CREATE UNIQUE INDEX IF NOT EXISTS ingest_dead_letters_open_record_idx
  ON ingest_dead_letters (source, external_id)
  WHERE kind = 'record' AND state = 'open';

CREATE INDEX IF NOT EXISTS ingest_dead_letters_state_idx
  ON ingest_dead_letters (state, created_at DESC);

CREATE INDEX IF NOT EXISTS ingest_jobs_lease_idx
  ON ingest_jobs (status, lease_expires_at);
