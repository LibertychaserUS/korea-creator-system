-- Value tiers: labels only, nothing is ever deleted because of them.
--   pinned       — a decision rested on it (publish / assignment / export /
--                  audit), an anomaly and the snapshot before it, or the latest
--   change_point — a swinging-door change point on at least one metric
--   downsample   — in between change points; could be thinned out one day
--   cold         — like downsample but older than the cold threshold
-- tier_features records why (reasons, changed metrics, relative deltas, age).
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS value_tier text;
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS tier_features jsonb;
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS tiered_at timestamptz;
ALTER TABLE creator_raw ADD COLUMN IF NOT EXISTS value_tier text;
ALTER TABLE creator_raw ADD COLUMN IF NOT EXISTS tier_features jsonb;
ALTER TABLE creator_raw ADD COLUMN IF NOT EXISTS tiered_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_metrics_history_value_tier_check') THEN
    ALTER TABLE creator_metrics_history ADD CONSTRAINT creator_metrics_history_value_tier_check
      CHECK (value_tier IS NULL OR value_tier IN ('pinned', 'change_point', 'downsample', 'cold'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_raw_value_tier_check') THEN
    ALTER TABLE creator_raw ADD CONSTRAINT creator_raw_value_tier_check
      CHECK (value_tier IS NULL OR value_tier IN ('pinned', 'change_point', 'downsample', 'cold'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS creator_metrics_history_value_tier_idx ON creator_metrics_history (value_tier);
CREATE INDEX IF NOT EXISTS creator_raw_value_tier_idx ON creator_raw (value_tier);
