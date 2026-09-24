-- Daily storage readings for the ops console's capacity card and forecast.
-- One row per (day, scope, name); taking the reading again on the same day
-- replaces that day's numbers. Nothing here is ever deleted by the app.
--   scope = 'database'   name = current database          total_bytes
--         = 'table'      name = relation                  total / table / index / toast bytes, live / dead tuples
--         = 'disk'       name = mount path or 'declared'  fs_size / fs_used / fs_avail bytes
--         = 'wal'        name = 'pg_wal'                  total_bytes
--         = 'backup'     name = backup directory          total_bytes (+ fs_* of its disk)
--         = 'source'     name = source id                 records, calls, avg_raw_bytes
--         = 'forecast'   name = 'disk'                    level + detail (what the alert was based on)
CREATE TABLE IF NOT EXISTS ops_capacity_daily (
  day date NOT NULL,
  scope text NOT NULL,
  name text NOT NULL,
  total_bytes bigint,
  table_bytes bigint,
  index_bytes bigint,
  toast_bytes bigint,
  live_tuples bigint,
  dead_tuples bigint,
  fs_size_bytes bigint,
  fs_used_bytes bigint,
  fs_avail_bytes bigint,
  records bigint,
  calls bigint,
  avg_raw_bytes double precision,
  level text,
  detail jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, scope, name)
);

CREATE INDEX IF NOT EXISTS ops_capacity_daily_scope_day_idx
  ON ops_capacity_daily (scope, name, day DESC);
