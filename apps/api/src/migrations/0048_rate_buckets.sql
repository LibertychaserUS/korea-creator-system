-- Per-source rate-limit token bucket, shared by whichever process drains the
-- queue: a restart or a failover continues with the real number of tokens
-- instead of a full bucket.
CREATE TABLE IF NOT EXISTS ingest_rate_buckets (
  source text PRIMARY KEY,
  capacity double precision NOT NULL,
  tokens double precision NOT NULL,
  updated_at timestamptz NOT NULL
);
