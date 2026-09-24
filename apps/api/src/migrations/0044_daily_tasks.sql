-- One row per (daily task, day): the queue holder claims the row before it
-- runs the task, so a restart or a second replica never runs it twice a day.
CREATE TABLE IF NOT EXISTS ingest_daily_runs (
  task text NOT NULL,
  day date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  result jsonb,
  error text,
  PRIMARY KEY (task, day)
);

CREATE INDEX IF NOT EXISTS ingest_daily_runs_day_idx ON ingest_daily_runs (day DESC);
