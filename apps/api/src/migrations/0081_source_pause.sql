-- A source the queue took offline by itself: the vendor said the account can
-- no longer pay (HTTP 402). Nothing of it runs until a human resumes it; the
-- run that hit the wall is parked as a dead letter and can be replayed.
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS paused_code text;
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS paused_detail text;
