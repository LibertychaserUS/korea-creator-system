-- Data-side status of a creator: not refreshed for a while, no longer found
-- on the platform, or holding newer numbers than the published snapshot.
-- Nothing here deletes a creator; a missing one is only flagged for ops.

-- Consecutive refreshes (lookups by id) that came back without this id.
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS miss_count integer NOT NULL DEFAULT 0;
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS missing_since timestamptz;
-- Set once `miss_count` reaches the threshold.
ALTER TABLE creator_sources ADD COLUMN IF NOT EXISTS missing_at timestamptz;

-- Any link missing → flagged, out of the pool until ops decides.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS platform_missing_at timestamptz;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS platform_missing_confirmed_at timestamptz;
-- Latest numbers vs the published snapshot (`metrics_locked`), as of `republish_checked_at`.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS republish_changes text[];
ALTER TABLE creators ADD COLUMN IF NOT EXISTS republish_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS creators_platform_missing_idx ON creators (platform_missing_at) WHERE platform_missing_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS creators_metrics_fetched_idx ON creators (metrics_fetched_at);

-- Ids a refresh job has seen so far, across pages and restarts.
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS seen_external_ids text[];
