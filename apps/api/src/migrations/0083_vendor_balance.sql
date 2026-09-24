-- Account balance at the paid gateway, read once a day (and on demand) from
-- its free account endpoint. One row per check, kept like every other
-- record for now (no retention).
CREATE TABLE IF NOT EXISTS vendor_balance_checks (
  id bigserial PRIMARY KEY,
  vendor text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  balance_usd numeric(14, 4),
  free_credit_usd numeric(14, 4),
  request_id text,
  error text
);
CREATE INDEX IF NOT EXISTS vendor_balance_checks_latest ON vendor_balance_checks (vendor, checked_at DESC);
