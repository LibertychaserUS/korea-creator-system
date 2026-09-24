-- Paid calls are metered one by one (reserve before the request, settle after
-- by the vendor's billing rule) and priced, so a day can be capped in money
-- as well as in calls.
--   ingest_sources.daily_budget_usd  NULL = no money cap (call quota only)
--   ingest_source_usage.calls        billed calls (what the quota counts)
--   .cost_micros                     their price, micro-USD
--   .requests                        requests sent, billed or not
--   .unbilled                        requests the vendor did not charge (non-200 on TikHub)
--   .maybe_billed                    timeouts after sending: kept as billed
--   .empty_results                   answers with nothing in them (billed, 查无结果)
--   .unpriced_calls                  billed calls of an endpoint with no known price
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS daily_budget_usd numeric(12, 4)
  CHECK (daily_budget_usd IS NULL OR daily_budget_usd >= 0);
UPDATE ingest_sources SET daily_budget_usd = 5 WHERE id = 'pugongying' AND daily_budget_usd IS NULL;

ALTER TABLE ingest_source_usage ADD COLUMN IF NOT EXISTS cost_micros bigint NOT NULL DEFAULT 0;
ALTER TABLE ingest_source_usage ADD COLUMN IF NOT EXISTS requests integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_source_usage ADD COLUMN IF NOT EXISTS unbilled integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_source_usage ADD COLUMN IF NOT EXISTS maybe_billed integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_source_usage ADD COLUMN IF NOT EXISTS empty_results integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_source_usage ADD COLUMN IF NOT EXISTS unpriced_calls integer NOT NULL DEFAULT 0;

ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS cost_micros bigint NOT NULL DEFAULT 0;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS vendor_requests integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS empty_count integer NOT NULL DEFAULT 0;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS vendor_notes jsonb NOT NULL DEFAULT '[]'::jsonb;
