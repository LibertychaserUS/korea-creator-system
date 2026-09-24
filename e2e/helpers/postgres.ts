import { Pool, type QueryResult, type QueryResultRow } from 'pg';

function databaseUrl(): string | undefined {
  // Prefer the compose e2e database. Do not silently use the app's leftover :5432 URL.
  return process.env.E2E_DATABASE_URL;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      'E2E_DATABASE_URL / DATABASE_URL is unset — journeys require PostgreSQL (see e2e/.env.example).',
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 3 });
  }
  return pool;
}

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function tableExists(name: string): Promise<boolean> {
  const res = await sql<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [name],
  );
  return Boolean(res.rows[0]?.exists);
}

export async function requireTable(name: string): Promise<void> {
  if (!(await tableExists(name))) {
    throw new Error(`PostgreSQL table "${name}" is missing — product SQL is not real yet.`);
  }
}

export async function findCreatorByDisplayName(displayName: string) {
  await requireTable('creators');
  const res = await sql(
    `SELECT id, creator_key, display_name, status, followers
     FROM creators
     WHERE display_name = $1
     ORDER BY id DESC
     LIMIT 1`,
    [displayName],
  );
  return res.rows[0] ?? null;
}

export async function findAssignment(opts: {
  projectId?: string;
  creatorId?: string;
  creatorKey?: string;
  displayName?: string;
}) {
  await requireTable('assignments');
  if (opts.projectId && opts.creatorId) {
    const res = await sql(
      `SELECT id, project_id, creator_id, status, assigned_by
       FROM assignments
       WHERE project_id = $1 AND creator_id = $2
       LIMIT 1`,
      [opts.projectId, opts.creatorId],
    );
    return res.rows[0] ?? null;
  }
  if (opts.creatorKey) {
    await requireTable('creators');
    const res = await sql(
      `SELECT a.id, a.project_id, a.creator_id, a.status, a.assigned_by
       FROM assignments a
       JOIN creators c ON c.id = a.creator_id
       WHERE c.creator_key = $1
       ORDER BY a.assigned_at DESC NULLS LAST
       LIMIT 1`,
      [opts.creatorKey],
    );
    return res.rows[0] ?? null;
  }
  if (opts.displayName) {
    await requireTable('creators');
    const res = await sql(
      `SELECT a.id, a.project_id, a.creator_id, a.status, a.assigned_by
       FROM assignments a
       JOIN creators c ON c.id = a.creator_id
       WHERE c.display_name = $1
       ORDER BY a.assigned_at DESC NULLS LAST
       LIMIT 1`,
      [opts.displayName],
    );
    return res.rows[0] ?? null;
  }
  throw new Error('findAssignment needs projectId+creatorId, creatorKey, or displayName');
}

export async function countIngestJobs(): Promise<number> {
  await requireTable('ingest_jobs');
  const res = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ingest_jobs`);
  return Number(res.rows[0]?.n ?? 0);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
