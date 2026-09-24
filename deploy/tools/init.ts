/**
 * One-off, idempotent production init (compose service `init`, re-run on every `up`):
 *   1. wait for Postgres; create the two databases when the role may (self-hosted)
 *   2. KCS business schema: apps/api migrations (advisory-locked, versioned)
 *   3. pg_stat_statements in both databases (best effort — RDS enables it in the console)
 *   4. TinyShip identity schema: drizzle push of libs/database/schema/pg, refusing
 *      anything that would drop data unless INIT_ALLOW_DATA_LOSS=1
 *   5. first platform admin from KCS_ADMIN_EMAIL / KCS_ADMIN_PASSWORD, only when that
 *      email does not exist yet — an existing account is never touched
 * Demo data is never loaded here.
 */
import { createRequire } from 'node:module'
import pg from 'pg'

const require = createRequire(import.meta.url)

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), job: 'init', msg, ...extra }))

function fail(msg: string, extra: Record<string, unknown> = {}): never {
  console.error(JSON.stringify({ ts: new Date().toISOString(), job: 'init', level: 'error', msg, ...extra }))
  process.exit(1)
}

function requireUrl(name: string): URL {
  const raw = process.env[name]?.trim()
  if (!raw) fail(`${name} is required`)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    fail(`${name} is not a valid postgres:// URL`)
  }
  if (!decodeURIComponent(url.password)) fail(`${name} has no password (set POSTGRES_PASSWORD, or the full URL for RDS)`)
  return url
}

const redact = (url: URL) => `${url.protocol}//${url.username}@${url.host}${url.pathname}`
const dbName = (url: URL) => decodeURIComponent(url.pathname.slice(1))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer(url: URL) {
  const deadline = Date.now() + Number(process.env.INIT_WAIT_SECONDS || 120) * 1000
  const probe = new URL(url)
  probe.pathname = '/postgres'
  let last: unknown
  while (Date.now() < deadline) {
    for (const target of [url, probe]) {
      const client = new pg.Client({ connectionString: target.toString() })
      try {
        await client.connect()
        await client.end()
        return
      } catch (error) {
        last = error
        await client.end().catch(() => {})
        // Server is up, the database just doesn't exist yet: ensureDatabase handles it.
        if ((error as { code?: string }).code === '3D000') return
      }
    }
    await sleep(2000)
  }
  fail('postgres not reachable', { url: redact(url), error: String(last) })
}

async function ensureDatabase(url: URL) {
  const name = dbName(url)
  const direct = new pg.Client({ connectionString: url.toString() })
  try {
    await direct.connect()
    await direct.end()
    return
  } catch (error) {
    await direct.end().catch(() => {})
    if ((error as { code?: string }).code !== '3D000') throw error
  }
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const client = new pg.Client({ connectionString: admin.toString() })
  try {
    await client.connect()
    await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`)
    log('database created', { database: name })
  } catch (error) {
    fail(`database ${name} does not exist and could not be created — create it (RDS console) and re-run`, {
      error: String(error),
    })
  } finally {
    await client.end().catch(() => {})
  }
}

async function enableStatStatements(url: URL) {
  const client = new pg.Client({ connectionString: url.toString() })
  try {
    await client.connect()
    // Its own schema: in `public` the identity push would try to drop the extension's views.
    await client.query('CREATE SCHEMA IF NOT EXISTS monitoring')
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA monitoring')
    const { rows: where } = await client.query(
      "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_stat_statements'",
    )
    if (where[0]?.nspname === 'public') await client.query('ALTER EXTENSION pg_stat_statements SET SCHEMA monitoring')
    const { rows } = await client.query("SELECT current_setting('shared_preload_libraries') AS libs")
    const loaded = String(rows[0]?.libs ?? '').includes('pg_stat_statements')
    log('pg_stat_statements', { database: dbName(url), extension: true, preloaded: loaded })
  } catch (error) {
    log('pg_stat_statements unavailable (enable it in the RDS parameter template)', {
      database: dbName(url),
      error: String(error),
    })
  } finally {
    await client.end().catch(() => {})
  }
}

async function migrateKcs(url: URL) {
  const { connectDb } = await import('../../apps/api/src/db')
  const { migrate } = await import('../../apps/api/src/migrate')
  const db = await connectDb(url.toString())
  try {
    await migrate(db)
    const { rows } = await db.query('SELECT count(*)::int AS n, max(version) AS latest FROM schema_migrations')
    log('kcs migrations applied', { database: dbName(url), count: rows[0].n, latest: rows[0].latest })
  } finally {
    await db.end()
  }
}

async function pushIdentitySchema(url: URL) {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schemaModule = await import('../../libs/database/schema/pg/index')
  const tables = (schemaModule as { default?: object }).default ?? schemaModule
  // drizzle-kit/api's ESM build breaks on its own dynamic requires; the CJS one works.
  const { pushSchema } = require('drizzle-kit/api') as typeof import('drizzle-kit/api')
  const pool = new pg.Pool({ connectionString: url.toString() })
  try {
    const db = drizzle(pool)
    const result = await pushSchema(tables as Record<string, unknown>, db as never)
    // drizzle only flags dropped tables/columns; a dropped view, type or index is refused too.
    const drops = result.statementsToExecute.filter((sql) => /^\s*drop\s/i.test(sql))
    if ((result.hasDataLoss || drops.length) && process.env.INIT_ALLOW_DATA_LOSS !== '1') {
      fail('identity schema change would drop data; review and re-run with INIT_ALLOW_DATA_LOSS=1', {
        warnings: result.warnings,
        statements: result.statementsToExecute,
      })
    }
    if (result.statementsToExecute.length) await result.apply()
    log('identity schema in sync', { database: dbName(url), statements: result.statementsToExecute.length })
  } finally {
    await pool.end()
  }
}

async function ensureAdmin(url: URL) {
  // @libs/database reads DATABASE_URL when first imported.
  process.env.DATABASE_URL = url.toString()
  process.env.DB_DIALECT = 'pg'
  process.env.BETTER_AUTH_URL ||= 'http://localhost'
  const { SEED_PASSWORD, SEED_USERS } = await import('@kcs/contract')
  const { db, pool, user } = await import('../../libs/database/index')
  const { eq, inArray } = await import('drizzle-orm')
  try {
    const demo = await db.select({ email: user.email }).from(user)
      .where(inArray(user.email, SEED_USERS.map((u) => u.email)))
    if (demo.length) {
      log('WARNING demo accounts present in the identity database — remove them before go-live', {
        emails: demo.map((row) => row.email),
      })
    }

    const email = process.env.KCS_ADMIN_EMAIL?.trim().toLowerCase()
    if (!email) {
      const admins = await db.select({ email: user.email }).from(user)
        .where(inArray(user.role, ['platform_admin', 'admin']))
      if (!admins.length) log('WARNING no platform admin yet — set KCS_ADMIN_EMAIL / KCS_ADMIN_PASSWORD and re-run')
      return
    }
    const existing = await db.query.user.findFirst({ where: eq(user.email, email) })
    if (existing) {
      log('admin account exists, left unchanged', { email, role: existing.role })
      return
    }
    const password = process.env.KCS_ADMIN_PASSWORD ?? ''
    if (password.length < 12) fail('KCS_ADMIN_PASSWORD must be at least 12 characters')
    if (password === SEED_PASSWORD) fail('KCS_ADMIN_PASSWORD must not be the demo seed password')

    const { auth } = await import('../../libs/auth/auth')
    await auth.api.createUser({
      body: {
        email,
        password,
        name: process.env.KCS_ADMIN_NAME?.trim() || '平台管理员',
        role: 'platform_admin' as 'admin',
      },
    })
    await db.update(user)
      .set({ role: 'platform_admin', emailVerified: true, updatedAt: new Date() })
      .where(eq(user.email, email))
    log('platform admin created', { email })
  } finally {
    if (pool?.end) await pool.end()
  }
}

async function main() {
  if (process.env.KCS_SEED) log('KCS_SEED is ignored by init: production never loads demo data')
  const secret = process.env.BETTER_AUTH_SECRET ?? ''
  if (secret.length < 32) fail('BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 48)')

  const kcs = requireUrl('KCS_DATABASE_URL')
  const identity = requireUrl('IDENTITY_DATABASE_URL')
  if (kcs.host === identity.host && dbName(kcs) === dbName(identity)) {
    fail('KCS_DATABASE_URL and IDENTITY_DATABASE_URL must point at different databases')
  }
  log('start', { kcs: redact(kcs), identity: redact(identity) })

  await waitForServer(kcs)
  await ensureDatabase(kcs)
  await waitForServer(identity)
  await ensureDatabase(identity)

  await migrateKcs(kcs)
  await enableStatStatements(kcs)
  await enableStatStatements(identity)
  await pushIdentitySchema(identity)
  await ensureAdmin(identity)
  log('done')
}

main().catch((error) => fail('init failed', { error: error instanceof Error ? error.stack : String(error) }))
