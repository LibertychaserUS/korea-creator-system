import type { Db } from './db'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS orgs (
    id text PRIMARY KEY,
    name text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    org_id text NOT NULL REFERENCES orgs(id),
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    display_name text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    slug text PRIMARY KEY,
    name_zh text NOT NULL,
    name_en text NOT NULL,
    name_ko text NOT NULL,
    builtin boolean NOT NULL DEFAULT false,
    enabled boolean NOT NULL DEFAULT true,
    group_name text,
    frontend_visible boolean NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS ingest_sources (
    id text PRIMARY KEY,
    name text NOT NULL,
    adapter_type text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    rate_limit integer,
    quota integer,
    owner text
  )`,
  `CREATE TABLE IF NOT EXISTS ingest_jobs (
    id text PRIMARY KEY,
    source_id text NOT NULL REFERENCES ingest_sources(id),
    schedule text NOT NULL,
    status text NOT NULL,
    attempt integer NOT NULL DEFAULT 0,
    written_count integer NOT NULL DEFAULT 0,
    skipped_dupes integer NOT NULL DEFAULT 0,
    failed_count integer NOT NULL DEFAULT 0,
    error_code text,
    error_summary text,
    sample_rate numeric NOT NULL DEFAULT 0.1,
    opened_by text,
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS creators (
    id text PRIMARY KEY,
    creator_key text UNIQUE NOT NULL,
    display_name text NOT NULL,
    status text NOT NULL,
    needs_review boolean NOT NULL DEFAULT false,
    followers integer,
    followers_unknown boolean NOT NULL DEFAULT false,
    regions text[] NOT NULL DEFAULT '{}',
    verticals text[] NOT NULL DEFAULT '{}',
    rating numeric(3,1),
    available_from date,
    available_to date,
    last_ingest_job_id text,
    avatar_key text,
    note text,
    qc_notes text,
    label text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS creator_categories (
    creator_id text REFERENCES creators(id) ON DELETE CASCADE,
    category_slug text REFERENCES categories(slug),
    PRIMARY KEY (creator_id, category_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS collaborations (
    id text PRIMARY KEY,
    creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    brand text NOT NULL,
    happened_at date,
    note text
  )`,
  `CREATE TABLE IF NOT EXISTS prices (
    id text PRIMARY KEY,
    creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    amount_min integer,
    amount_max integer,
    currency text NOT NULL DEFAULT 'CNY',
    unit text NOT NULL DEFAULT 'per_post',
    valid_until date
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY,
    org_id text NOT NULL REFERENCES orgs(id),
    name text NOT NULL,
    note text,
    status text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS assignments (
    project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    creator_id text NOT NULL REFERENCES creators(id),
    status text NOT NULL DEFAULT 'assigned',
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by text NOT NULL,
    pool_gone boolean NOT NULL DEFAULT false,
    PRIMARY KEY (project_id, creator_id)
  )`,
  `CREATE TABLE IF NOT EXISTS shortlist_items (
    org_id text NOT NULL,
    creator_id text NOT NULL REFERENCES creators(id),
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, creator_id)
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id text PRIMARY KEY,
    creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    risk_level text NOT NULL,
    conclusion text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id text PRIMARY KEY,
    actor_id text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    summary text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS id text`,
  `UPDATE assignments SET id = gen_random_uuid()::text WHERE id IS NULL`,
  `CREATE TABLE IF NOT EXISTS assets (
    key text PRIMARY KEY,
    url text NOT NULL,
    content_type text,
    size integer NOT NULL DEFAULT 0,
    bytes bytea,
    uploaded_by text
  )`,
  `CREATE TABLE IF NOT EXISTS "user" (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text,
    role text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_key text`,
  `ALTER TABLE creators ADD COLUMN IF NOT EXISTS xhs_id text`,
  `ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS file_name text`,
  `ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS batch_name text`,
  `ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS source_rows integer`,
  `CREATE OR REPLACE VIEW creator AS SELECT * FROM creators`,
  `CREATE OR REPLACE VIEW assignment AS
     SELECT id, project_id, creator_id, status, assigned_by, assigned_at FROM assignments`,
  `CREATE OR REPLACE VIEW ingest_job AS SELECT * FROM ingest_jobs`,
  `CREATE OR REPLACE VIEW price AS SELECT * FROM prices`,
  `CREATE OR REPLACE VIEW project AS SELECT * FROM projects`,
  `CREATE OR REPLACE VIEW creator_category AS
     SELECT creator_id, category_slug AS slug FROM creator_categories`,
]

export async function migrate(db: import('./db').Db): Promise<void> {
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  for (const sql of STATEMENTS) {
    await db.query(sql)
  }
  await db.query(`
    CREATE OR REPLACE FUNCTION kcs_sync_user_role() RETURNS trigger AS $$
    BEGIN
      UPDATE users SET role = NEW.role WHERE email = NEW.email;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
  await db.query(`DROP TRIGGER IF EXISTS trg_user_role ON "user"`)
  await db.query(`
    CREATE TRIGGER trg_user_role AFTER UPDATE OF role ON "user"
    FOR EACH ROW EXECUTE FUNCTION kcs_sync_user_role()
  `)
}
