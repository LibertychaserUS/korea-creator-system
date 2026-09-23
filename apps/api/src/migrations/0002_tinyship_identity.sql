DROP TRIGGER IF EXISTS trg_user_role ON "user";
DROP FUNCTION IF EXISTS kcs_sync_user_role();
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS "user";

ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
