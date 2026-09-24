-- Manual quotes: amounts in the currency's smallest unit (bigint; 分 / cents, 원 for KRW),
-- an upper-case currency from a fixed list, and — only when someone recorded it — the
-- rate to 人民币 used for cost ratios. `integer` could not hold 1.5 元 or 30 亿원.
ALTER TABLE prices ADD COLUMN IF NOT EXISTS amount_min_minor bigint;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS amount_max_minor bigint;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS fx_to_cny numeric(20, 10);
ALTER TABLE prices ADD COLUMN IF NOT EXISTS fx_recorded_at timestamptz;

UPDATE prices SET currency = upper(btrim(currency)) WHERE currency <> upper(btrim(currency));

-- The old integer columns become read-only views of the new ones (whole major units,
-- NULL when they do not fit), so older readers keep working; nothing writes them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'prices'
       AND column_name = 'amount_min' AND is_generated = 'NEVER'
  ) THEN
    UPDATE prices SET
      amount_min_minor = COALESCE(amount_min_minor, amount_min::bigint * CASE currency WHEN 'KRW' THEN 1 ELSE 100 END),
      amount_max_minor = COALESCE(amount_max_minor, amount_max::bigint * CASE currency WHEN 'KRW' THEN 1 ELSE 100 END);
    ALTER TABLE prices DROP COLUMN amount_min;
    ALTER TABLE prices DROP COLUMN amount_max;
  END IF;
END
$$;

ALTER TABLE prices ADD COLUMN IF NOT EXISTS amount_min integer GENERATED ALWAYS AS (
  CASE WHEN amount_min_minor / CASE currency WHEN 'KRW' THEN 1 ELSE 100 END BETWEEN -2147483648 AND 2147483647
    THEN (amount_min_minor / CASE currency WHEN 'KRW' THEN 1 ELSE 100 END)::integer END
) STORED;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS amount_max integer GENERATED ALWAYS AS (
  CASE WHEN amount_max_minor / CASE currency WHEN 'KRW' THEN 1 ELSE 100 END BETWEEN -2147483648 AND 2147483647
    THEN (amount_max_minor / CASE currency WHEN 'KRW' THEN 1 ELSE 100 END)::integer END
) STORED;

ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_currency_check;
-- NOT VALID: rows with another code stay readable (shown, never converted); new writes must use the list.
ALTER TABLE prices ADD CONSTRAINT prices_currency_check CHECK (currency IN ('CNY', 'USD', 'KRW')) NOT VALID;
ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_amount_check;
ALTER TABLE prices ADD CONSTRAINT prices_amount_check
  CHECK (amount_min_minor IS NULL OR amount_min_minor >= 0) NOT VALID;
