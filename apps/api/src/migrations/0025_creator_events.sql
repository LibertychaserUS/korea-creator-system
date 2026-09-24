-- Outcome events: what happened to a creator after it reached the pool
-- (published, taken down, assigned to a project, removed from one, exported,
-- its detail page opened by a selector). Kept for calibration and for the
-- ingest scheduler's "was this discovery worth it" signal (line B reads it);
-- never used for ranking. Append-only: nothing updates or deletes rows.
--
-- `creator_id` has no foreign key on purpose, so the history outlives a
-- creator row that is merged away. `source` is the creator's data source at
-- the time of the event.
CREATE TABLE IF NOT EXISTS creator_events (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('publish', 'unpublish', 'assign', 'unassign', 'export', 'detail_view')),
  creator_id text NOT NULL,
  org_id text,
  actor_id text,
  project_id text,
  source text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_events_creator_idx ON creator_events (creator_id, occurred_at);
CREATE INDEX IF NOT EXISTS creator_events_kind_idx ON creator_events (kind, occurred_at);
CREATE INDEX IF NOT EXISTS creator_events_view_idx ON creator_events (creator_id, actor_id, occurred_at) WHERE kind = 'detail_view';
