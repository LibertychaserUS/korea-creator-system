-- Scheduler: refresh known creators, discover new ones.

-- Per (source, external_id) refresh statistics for the Poisson change model.
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS refresh_visits integer NOT NULL DEFAULT 0;
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS refresh_changes integer NOT NULL DEFAULT 0;
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS observed_days double precision NOT NULL DEFAULT 0;
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS change_rate double precision;
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS refresh_interval_days double precision;
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS next_refresh_at timestamptz;
CREATE INDEX IF NOT EXISTS creator_sources_refresh_due_idx ON creator_sources (source, next_refresh_at);

-- Whether a snapshot differs materially from the previous one of the same source.
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS material_change boolean;
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS changed_metrics text[];
CREATE INDEX IF NOT EXISTS creator_metrics_history_job_idx ON creator_metrics_history (job_id);

-- The job that first brought a creator in (discovery reward).
ALTER TABLE creators ADD COLUMN IF NOT EXISTS first_ingest_job_id text;
CREATE INDEX IF NOT EXISTS creators_first_ingest_job_idx ON creators (first_ingest_job_id);

-- Why a job exists: 'once' (someone asked), 'refresh', 'discovery', 'workbook'.
CREATE INDEX IF NOT EXISTS ingest_jobs_schedule_created_idx ON ingest_jobs (schedule, created_at DESC);

-- Saved crawler parameters searched on a timer.
CREATE TABLE IF NOT EXISTS ingest_discovery_searches (
  id text PRIMARY KEY,
  source text NOT NULL REFERENCES ingest_sources(id),
  name text NOT NULL,
  query jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  max_pages integer NOT NULL DEFAULT 1 CHECK (max_pages BETWEEN 1 AND 100),
  every_hours integer NOT NULL DEFAULT 24 CHECK (every_hours BETWEEN 1 AND 8760),
  last_enqueued_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The last plan and the numbers behind it (shown on the ops console).
CREATE TABLE IF NOT EXISTS ingest_scheduler_state (
  id text PRIMARY KEY,
  planned_at timestamptz NOT NULL,
  state jsonb NOT NULL
);
