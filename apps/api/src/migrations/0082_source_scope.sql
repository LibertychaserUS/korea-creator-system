-- Which notes and which traffic a source is asked for (蒲公英 `business` and
-- `advertise_switch`). NULL = the adapter default (SOURCE_SCOPE_DEFAULTS:
-- 全部流量 · 日常笔记); PGY_TRAFFIC_SCOPE / PGY_BUSINESS_SCOPE win over both.
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS traffic_scope text
  CHECK (traffic_scope IS NULL OR traffic_scope IN ('all', 'organic'));
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS business_scope text
  CHECK (business_scope IS NULL OR business_scope IN ('daily', 'coop'));
