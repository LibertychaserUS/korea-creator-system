-- The daily quota resets at the vendor's midnight, not UTC's. All three
-- sources bill by Beijing time; a different vendor sets its own zone here.
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS quota_tz text NOT NULL DEFAULT 'Asia/Shanghai';
