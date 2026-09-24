-- One history snapshot per creator, source, window and Beijing day: a later
-- fetch the same day overwrites the earlier one. Every fetch still keeps its
-- own row in `creator_raw`, so no measurement is lost — only the redundant
-- same-day copies of the parsed numbers.
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS snapshot_day date
  GENERATED ALWAYS AS ((fetched_at AT TIME ZONE 'Asia/Shanghai')::date) STORED;

DELETE FROM creator_metrics_history h
 USING creator_metrics_history newer
 WHERE newer.creator_id = h.creator_id
   AND newer.source = h.source
   AND newer."window" = h."window"
   AND newer.snapshot_day = h.snapshot_day
   AND (newer.fetched_at, newer.id) > (h.fetched_at, h.id);

CREATE UNIQUE INDEX IF NOT EXISTS creator_metrics_history_day_uidx
  ON creator_metrics_history (creator_id, source, "window", snapshot_day);
