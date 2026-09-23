-- Baseline objects nothing reads or writes any more. Every statement is
-- idempotent: a database that never had them, or already lost them in 0002,
-- passes through unchanged.

-- Singular compatibility views over the real tables; no code or test queries them.
DROP VIEW IF EXISTS creator;
DROP VIEW IF EXISTS assignment;
DROP VIEW IF EXISTS ingest_job;
DROP VIEW IF EXISTS price;
DROP VIEW IF EXISTS project;
DROP VIEW IF EXISTS creator_category;

-- Local sessions and the "user" mirror + trigger were replaced by TinyShip identity (0002).
-- TinyShip's own "user" table (email_verified, credit_balance, ...) must survive
-- a misconfigured shared database, so only the five-column KCS mirror is dropped.
DO $$
BEGIN
  IF to_regclass('public."user"') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_user_role ON public."user";
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'email_verified'
    ) THEN
      DROP TABLE public."user";
    END IF;
  END IF;
END
$$;
DROP FUNCTION IF EXISTS kcs_sync_user_role();
DROP TABLE IF EXISTS sessions;

-- Pre-metrics scalar columns; engagement and locked numbers live in metrics / metrics_locked.
ALTER TABLE creators DROP COLUMN IF EXISTS er;
ALTER TABLE creators DROP COLUMN IF EXISTS locked_final;
