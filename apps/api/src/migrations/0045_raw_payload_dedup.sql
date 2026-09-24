-- Lossless dedup of raw vendor JSON. The body is stored once per distinct
-- content in raw_payloads (key = sha256 of the jsonb text, which is canonical:
-- key order and whitespace do not matter); creator_raw keeps one row per fetch
-- (who, which source, when) pointing at it. Every fetch can still be read back
-- in full: COALESCE(creator_raw.payload, raw_payloads.payload).
CREATE TABLE IF NOT EXISTS raw_payloads (
  hash bytea PRIMARY KEY,
  payload jsonb NOT NULL,
  bytes integer NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now()
);

-- lz4 needs a server built with it; without it the column keeps pglz.
DO $$
BEGIN
  ALTER TABLE raw_payloads ALTER COLUMN payload SET COMPRESSION lz4;
  ALTER TABLE creator_raw ALTER COLUMN payload SET COMPRESSION lz4;
EXCEPTION WHEN feature_not_supported OR invalid_parameter_value OR undefined_object THEN
  RAISE NOTICE 'lz4 not available, raw JSON stays pglz-compressed';
END $$;

ALTER TABLE creator_raw ADD COLUMN IF NOT EXISTS payload_hash bytea;
ALTER TABLE creator_raw ALTER COLUMN payload DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_raw_payload_hash_fkey') THEN
    ALTER TABLE creator_raw ADD CONSTRAINT creator_raw_payload_hash_fkey
      FOREIGN KEY (payload_hash) REFERENCES raw_payloads(hash);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_raw_payload_present') THEN
    ALTER TABLE creator_raw ADD CONSTRAINT creator_raw_payload_present
      CHECK (payload IS NOT NULL OR payload_hash IS NOT NULL);
  END IF;
END $$;

-- Existing rows: move each distinct body over, then point the row at it.
INSERT INTO raw_payloads (hash, payload, bytes, first_seen_at)
SELECT DISTINCT ON (hash) hash, payload, octet_length(payload::text), first_seen_at
  FROM (
    SELECT sha256(convert_to(payload::text, 'UTF8')) AS hash, payload,
           min(fetched_at) OVER (PARTITION BY sha256(convert_to(payload::text, 'UTF8'))) AS first_seen_at
      FROM creator_raw
     WHERE payload IS NOT NULL AND payload_hash IS NULL
  ) legacy
 ORDER BY hash
ON CONFLICT (hash) DO NOTHING;

UPDATE creator_raw
   SET payload_hash = sha256(convert_to(payload::text, 'UTF8')), payload = NULL
 WHERE payload IS NOT NULL AND payload_hash IS NULL;

CREATE INDEX IF NOT EXISTS creator_raw_payload_hash_idx ON creator_raw (payload_hash);
