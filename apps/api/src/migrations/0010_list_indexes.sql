-- Indexes behind the identity lookups and the paged lists. Every list orders by
-- one timestamp and pages with LIMIT/OFFSET, so each gets a matching DESC index.

-- Identity: ingest and seed look a creator up by Xiaohongshu id before inserting.
CREATE INDEX IF NOT EXISTS creators_xhs_id_idx
  ON creators (xhs_id, updated_at DESC) WHERE xhs_id IS NOT NULL;

-- Select pool reads only released rows; ops list filters by status.
CREATE INDEX IF NOT EXISTS creators_status_idx
  ON creators (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS creators_updated_idx
  ON creators (updated_at DESC, id);
CREATE INDEX IF NOT EXISTS creators_source_idx
  ON creators (source) WHERE status = 'released';

-- Relations loaded per page by creator id.
CREATE INDEX IF NOT EXISTS collaborations_creator_idx ON collaborations (creator_id);
CREATE INDEX IF NOT EXISTS prices_creator_idx ON prices (creator_id);
CREATE INDEX IF NOT EXISTS assignments_creator_idx ON assignments (creator_id);
CREATE INDEX IF NOT EXISTS reviews_creator_idx ON reviews (creator_id);
CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews (status, created_at DESC);

-- Raw retention keeps the newest N per (creator, source).
CREATE INDEX IF NOT EXISTS creator_raw_creator_source_fetched_idx
  ON creator_raw (creator_id, source, fetched_at DESC, id DESC);

-- Jobs / batches lists and the overview.
CREATE INDEX IF NOT EXISTS ingest_jobs_created_idx ON ingest_jobs (created_at DESC, id);
CREATE INDEX IF NOT EXISTS ingest_jobs_updated_idx ON ingest_jobs (updated_at DESC, id);

-- Audit list and its retention sweep.
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

-- Dead-letter retention sweeps resolved entries by age.
CREATE INDEX IF NOT EXISTS ingest_dead_letters_resolved_idx
  ON ingest_dead_letters (resolved_at) WHERE state <> 'open';
