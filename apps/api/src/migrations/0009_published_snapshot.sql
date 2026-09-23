-- Publish freezes the numbers the select pool filters, sorts and ranks on:
-- `metrics_locked` is copied from `metrics` at publish / re-publish, and only
-- then. Ingest keeps writing `metrics` (latest) and history, never the snapshot.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS metrics_locked_at timestamptz;

-- Released rows from before this rule get their current numbers as the snapshot once.
UPDATE creators SET metrics_locked = metrics
 WHERE status = 'released' AND metrics_locked IS NULL AND metrics IS NOT NULL;

UPDATE creators SET metrics_locked_at = COALESCE(metrics_fetched_at, updated_at)
 WHERE metrics_locked IS NOT NULL AND metrics_locked_at IS NULL;
