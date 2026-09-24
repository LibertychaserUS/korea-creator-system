import {
  DEFAULT_QUOTA_TIME_ZONE,
  EXPORT_LABELS,
  EXPORT_LOCALES,
  checkLocaleKeys,
  parsePaging,
  type AuditEntryView,
  type DevAuditPage,
  type DevI18nReport,
  type DevPipeline,
  type PipelineSourceView,
} from '@kcs/contract'
import { validationError } from '../http/body'
import { quotaDay, quotaTimeZone } from '../ingest/worker'
import { dailyBudget } from '../ingest/meter'
import { auditLogView } from '../http/views'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : (value as string | null) ?? null)

/** `YYYY-MM-DD` shifted by whole days. */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const AUDIT_PAGE_DEFAULT = 100
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Each source's counters are cut on its own quota day (`quota_tz`), the same
 * day and reset `reserveQuota` in ingest/worker.ts uses; the top-level day is
 * the default zone's (Beijing).
 */
export async function pipelineReport(env: AppEnv): Promise<DevPipeline> {
  const now = env.now()
  const [totals, sources, usage, jobs, parked] = await Promise.all([
    env.db.query(`
      SELECT
        (SELECT count(*) FROM ingest_sources WHERE enabled)::int AS sources,
        (SELECT count(*) FROM ingest_jobs)::int AS jobs,
        (SELECT count(*) FROM creators WHERE needs_review)::int AS review,
        (SELECT count(*) FROM creators WHERE status = 'released')::int AS released
    `),
    env.db.query('SELECT id, name, adapter_type, enabled, rate_limit, quota, quota_tz, daily_budget_usd, paused_at, paused_code FROM ingest_sources ORDER BY id'),
    // Zones are at most a day apart, so this window covers every source's last 7 days.
    env.db.query(
      `SELECT source, to_char(day, 'YYYY-MM-DD') AS day, calls, cost_micros, requests, maybe_billed, empty_results, unpriced_calls
         FROM ingest_source_usage
        WHERE day > $1::date - 9 AND day <= $1::date + 1 ORDER BY day`,
      [now.toISOString().slice(0, 10)],
    ),
    env.db.query(
      `SELECT source_id,
          max(COALESCE(ended_at, updated_at)) FILTER (WHERE status = 'ok') AS last_success_at,
          max(updated_at) FILTER (WHERE status = 'failed') AS last_failure_at,
          (array_agg(error_code ORDER BY updated_at DESC) FILTER (WHERE status = 'failed'))[1] AS last_error_code,
          (array_agg(source_mode ORDER BY updated_at DESC) FILTER (WHERE source_mode IS NOT NULL))[1] AS last_mode,
          count(*) FILTER (WHERE status = 'running')::int AS running,
          count(*) FILTER (WHERE status IN ('queued', 'partial'))::int AS waiting,
          count(*) FILTER (WHERE status = 'failed' AND updated_at > $1::timestamptz - interval '24 hours')::int AS failed24h,
          COALESCE(sum(written_count) FILTER (WHERE created_at > $1::timestamptz - interval '24 hours'), 0)::int AS written24h
        FROM ingest_jobs GROUP BY source_id`,
      [now.toISOString()],
    ),
    env.db.query(
      "SELECT source, count(*)::int AS n FROM ingest_dead_letters WHERE state = 'open' GROUP BY source",
    ),
  ])
  const jobsBy = new Map(jobs.rows.map((row) => [row.source_id, row]))
  const parkedBy = new Map(parked.rows.map((row) => [row.source, Number(row.n)]))
  const zones = new Set([DEFAULT_QUOTA_TIME_ZONE, ...sources.rows.map((row) => quotaTimeZone(row.quota_tz))])
  const days = new Map(await Promise.all([...zones].map(async (tz) => [tz, await quotaDay(env, tz)] as const)))
  const items = sources.rows.map((row): PipelineSourceView => {
    const tz = quotaTimeZone(row.quota_tz)
    const { day, resetsAt } = days.get(tz)!
    const from = addDays(day, -7)
    const own = usage.rows.filter((u) => u.source === row.id && String(u.day) > from && String(u.day) <= day)
    const recentDays = own.map((u) => ({ day: String(u.day), calls: Number(u.calls), costUsd: Number(u.cost_micros ?? 0) / 1_000_000 }))
    const todayRow = own.find((u) => String(u.day) === day)
    const callsToday = Number(todayRow?.calls ?? 0)
    const costTodayUsd = Number(todayRow?.cost_micros ?? 0) / 1_000_000
    const quota = row.quota == null ? null : Number(row.quota)
    const { usd: budget, from: budgetFrom } = dailyBudget(row.id, row.daily_budget_usd)
    const job = jobsBy.get(row.id)
    return {
      id: row.id,
      name: row.name,
      adapterType: row.adapter_type,
      enabled: Boolean(row.enabled),
      pausedAt: iso(row.paused_at),
      pausedCode: row.paused_code ?? null,
      rateLimit: row.rate_limit == null ? null : Number(row.rate_limit),
      quota,
      quotaTimeZone: tz,
      quotaDay: day,
      resetsAt: resetsAt.toISOString(),
      callsToday,
      remainingToday: quota == null ? null : Math.max(0, quota - callsToday),
      usageRatio: quota ? callsToday / quota : null,
      costTodayUsd,
      dailyBudgetUsd: budget,
      budgetFrom,
      budgetRatio: budget ? costTodayUsd / budget : budget === 0 ? 1 : null,
      requestsToday: Number(todayRow?.requests ?? 0),
      maybeBilledToday: Number(todayRow?.maybe_billed ?? 0),
      emptyToday: Number(todayRow?.empty_results ?? 0),
      unpricedToday: Number(todayRow?.unpriced_calls ?? 0),
      recentDays,
      lastSuccessAt: iso(job?.last_success_at),
      lastFailureAt: iso(job?.last_failure_at),
      lastErrorCode: job?.last_error_code ?? null,
      lastMode: job?.last_mode ?? null,
      running: Number(job?.running ?? 0),
      waiting: Number(job?.waiting ?? 0),
      failed24h: Number(job?.failed24h ?? 0),
      written24h: Number(job?.written24h ?? 0),
      openDeadLetters: parkedBy.get(row.id) ?? 0,
    }
  })
  const base = days.get(DEFAULT_QUOTA_TIME_ZONE)!
  return {
    day: base.day,
    quotaTimeZone: DEFAULT_QUOTA_TIME_ZONE,
    resetsAt: base.resetsAt.toISOString(),
    totals: totals.rows[0],
    sources: items,
  }
}

type AuditFilter = { where: string; params: unknown[] } | { error: string }

export function auditFilter(query: Record<string, string | undefined>): AuditFilter {
  const params: unknown[] = []
  const where: string[] = []
  const add = (sql: (placeholder: string) => string, value: unknown) => {
    params.push(value)
    where.push(sql(`$${params.length}`))
  }
  const action = query.action?.trim()
  // `creator.` means the whole family; anything else is exact.
  if (action) {
    if (action.endsWith('.')) add((p) => `starts_with(a.action, ${p})`, action)
    else add((p) => `a.action = ${p}`, action)
  }
  if (query.actor?.trim()) add((p) => `a.actor_id = ${p}`, query.actor.trim())
  if (query.entityType?.trim()) add((p) => `a.entity_type = ${p}`, query.entityType.trim())
  if (query.entityId?.trim()) add((p) => `a.entity_id = ${p}`, query.entityId.trim())
  const needle = query.q?.trim()
  if (needle) {
    add(
      (p) => `(strpos(lower(a.summary), lower(${p})) > 0 OR strpos(lower(COALESCE(a.entity_id, '')), lower(${p})) > 0
        OR strpos(lower(COALESCE(u.display_name, '')), lower(${p})) > 0 OR strpos(lower(COALESCE(u.email, '')), lower(${p})) > 0)`,
      needle,
    )
  }
  for (const [key, op] of [['from', '>='], ['to', '<']] as const) {
    const raw = query[key]?.trim()
    if (!raw) continue
    if (!DAY.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return { error: `invalid_${key}` }
    // `to` is inclusive of the whole day.
    add((p) => `a.created_at ${op} (${p}::date${key === 'to' ? " + interval '1 day'" : ''})`, raw)
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

export async function auditPage(env: AppEnv, query: Record<string, string | undefined>): Promise<DevAuditPage | { error: string }> {
  const filter = auditFilter(query)
  if ('error' in filter) return filter
  const paging = parsePaging({ page: query.page, pageSize: query.pageSize ?? AUDIT_PAGE_DEFAULT })
  const from = `FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${filter.where}`
  const limit = `$${filter.params.length + 1}`
  const offset = `$${filter.params.length + 2}`
  const [rows, count, actions] = await Promise.all([
    env.db.query(
      `SELECT a.*, u.display_name AS actor_name, u.email AS actor_email ${from}
        ORDER BY a.created_at DESC, a.id COLLATE "C" LIMIT ${limit} OFFSET ${offset}`,
      [...filter.params, paging.pageSize, paging.offset],
    ),
    env.db.query(`SELECT count(*)::int AS n ${from}`, filter.params),
    env.db.query('SELECT action, count(*)::int AS n FROM audit_logs GROUP BY action ORDER BY action'),
  ])
  return {
    items: rows.rows.map((row): AuditEntryView => ({
      ...auditLogView(row),
      actorName: row.actor_name ?? null,
      actorEmail: row.actor_email ?? null,
    })),
    total: Number(count.rows[0].n),
    page: paging.page,
    pageSize: paging.pageSize,
    actions: actions.rows.map((row) => ({ action: row.action, n: Number(row.n) })),
  }
}

export function i18nReport(now: Date): DevI18nReport {
  return {
    locales: [...EXPORT_LOCALES],
    defaultLocale: 'zh-CN',
    themes: ['light', 'dark', 'system'],
    exportLabels: checkLocaleKeys(EXPORT_LABELS, 'zh-CN'),
    checkedAt: now.toISOString(),
  }
}

/**
 * 运维端: per-source calls and quota, the audit stream, the copy check.
 * Everything here is read-only.
 */
export function registerDevConsoleRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/dev/pipeline', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    return context.json(await pipelineReport(env))
  })

  app.get('/api/dev/audit', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const page = await auditPage(env, context.req.query())
    if ('error' in page) return validationError(context, page.error)
    return context.json(page)
  })

  app.get('/api/dev/i18n-theme', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    return context.json(i18nReport(env.now()))
  })
}
