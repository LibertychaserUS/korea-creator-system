-- Saved queries: 我的方案 (private, the author only) vs 团队方案 (the whole org),
-- a kept history of every version, and delete as archive (nothing is dropped).
ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team';
ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS archived_by text;
ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS updated_by text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_queries_visibility_check') THEN
    ALTER TABLE saved_queries ADD CONSTRAINT saved_queries_visibility_check CHECK (visibility IN ('private', 'team'));
  END IF;
END $$;

-- One row per version: what the query was (name, visibility, spec) right after
-- that change, who made it and what kind of change it was.
CREATE TABLE IF NOT EXISTS saved_query_revisions (
  query_id text NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
  version int NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore')),
  name text NOT NULL,
  visibility text NOT NULL,
  spec jsonb NOT NULL,
  edited_by text,
  edited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (query_id, version)
);

-- Queries saved before this migration: their current state becomes the first
-- known revision (earlier versions were never kept).
INSERT INTO saved_query_revisions (query_id, version, action, name, visibility, spec, edited_by, edited_at)
SELECT q.id, q.version, CASE WHEN q.version = 1 THEN 'create' ELSE 'update' END,
       q.name, q.visibility, q.spec, q.created_by, q.updated_at
  FROM saved_queries q
ON CONFLICT (query_id, version) DO NOTHING;

CREATE INDEX IF NOT EXISTS saved_queries_org_live_idx ON saved_queries (org_id, updated_at DESC) WHERE archived_at IS NULL;
