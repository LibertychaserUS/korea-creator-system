-- Lookups for the optional finished-job cleanup (off by default): a run a
-- creator still names as its first or last job is kept.
CREATE INDEX IF NOT EXISTS creators_first_ingest_job_idx ON creators (first_ingest_job_id) WHERE first_ingest_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creators_last_ingest_job_idx ON creators (last_ingest_job_id) WHERE last_ingest_job_id IS NOT NULL;
