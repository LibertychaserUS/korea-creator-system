import {
  SOURCE_BUDGET_ENV,
  SOURCE_IDS,
  usdToMicros,
  vendorPriceUsd,
  type CallMeter,
  type CallSettlement,
  type CallTicket,
  type SourceId,
} from '@kcs/contract'
import { MeterStop } from '../adapters/billing'
import type { AppEnv } from '../http/types'
import { logEvent } from '../log'

/**
 * Per-endpoint price overrides, `KCS_VENDOR_PRICES` = JSON of
 * `{ "<gateway>:<path prefix>": usd }`, e.g. `{"justoneapi:/api/xiaohongshu-pgy/": 0.015}`.
 * A broken value is ignored (list prices apply) and says so in the log.
 */
export function vendorPriceOverrides(source: NodeJS.ProcessEnv = process.env): Record<string, number> {
  const raw = source.KCS_VENDOR_PRICES
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const n = Number(value)
      if (key && Number.isFinite(n) && n >= 0) out[key] = n
    }
    return out
  } catch {
    logEvent('warn', 'billing.bad_price_override', { env: 'KCS_VENDOR_PRICES' })
    return {}
  }
}

/** A money figure from env: a non-negative number, or `undefined` when unset / unusable. */
function envUsd(value: string | undefined): number | null | undefined {
  if (value == null || value.trim() === '') return undefined
  if (/^(none|off|unlimited)$/i.test(value.trim())) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * The day's money cap for a source: `<SOURCE>_DAILY_BUDGET_USD` (a number, or
 * `none` for no cap) wins over `ingest_sources.daily_budget_usd`; `usd: null`
 * = only the call quota applies.
 */
export function dailyBudget(
  source: string,
  column: unknown,
  env: NodeJS.ProcessEnv = process.env,
): { usd: number | null; from: 'env' | 'source' | null } {
  const envName = (SOURCE_IDS as readonly string[]).includes(source) ? SOURCE_BUDGET_ENV[source as SourceId] : null
  const fromEnv = envName ? envUsd(env[envName]) : undefined
  if (fromEnv !== undefined) return { usd: fromEnv, from: 'env' }
  const n = column == null || column === '' ? NaN : Number(column)
  return Number.isFinite(n) && n >= 0 ? { usd: n, from: 'source' } : { usd: null, from: null }
}

export function dailyBudgetUsd(source: string, column: unknown, env: NodeJS.ProcessEnv = process.env): number | null {
  return dailyBudget(source, column, env).usd
}

export type SourceLimits = {
  rateLimit: number
  quota: number
  budgetUsd: number | null
  tz: string
}

export type MeterTotals = { calls: number; costMicros: number; requests: number; empties: number; maybe: number }

type QuotaDay = { day: string; resetsAt: Date }

export type MeterDeps = {
  quotaDay: (env: AppEnv, tz: string) => Promise<QuotaDay>
  takeToken: (env: AppEnv, source: string, ratePerMinute: number) => Promise<{ ok: boolean; waitMs: number }>
}

/**
 * The queue's meter for one run. Before each request: the claim is still
 * ours (and its lease is pushed out — one slow page must not lose it), a rate
 * token, and one call plus its price reserved on the quota day in a single
 * conditional UPDATE, so neither the quota nor the budget can be passed by
 * even one call. After it: the vendor's rule settles the call; an unbilled
 * one gives both back. The job row carries the same counters.
 */
export function createMeter(
  env: AppEnv,
  input: {
    source: string
    jobId: string
    lease: string
    leaseSeconds: number
    limits: SourceLimits
    shouldStop?: () => boolean
    deps: MeterDeps
  },
): CallMeter & { totals: MeterTotals } {
  const { source, jobId, lease, limits, deps } = input
  const overrides = vendorPriceOverrides()
  const budgetMicros = limits.budgetUsd == null ? null : usdToMicros(limits.budgetUsd)
  const totals: MeterTotals = { calls: 0, costMicros: 0, requests: 0, empties: 0, maybe: 0 }
  let cached: QuotaDay | null = null

  const today = async () => {
    if (!cached || env.now().getTime() >= cached.resetsAt.getTime()) cached = await deps.quotaDay(env, limits.tz)
    return cached
  }

  const stopping = () => new MeterStop('stopping', null)

  async function acquire(endpoint: string): Promise<CallTicket> {
    if (input.shouldStop?.()) throw stopping()
    const claim = await env.db.query(
      `UPDATE ingest_jobs SET lease_expires_at = now() + make_interval(secs => $3::float8), updated_at = now()
        WHERE id = $1 AND locked_by = $2 AND status = 'running' RETURNING id`,
      [jobId, lease, input.leaseSeconds],
    )
    if (!claim.rowCount) throw stopping()
    for (;;) {
      const token = await deps.takeToken(env, source, limits.rateLimit)
      if (token.ok) break
      if (input.shouldStop?.()) throw stopping()
      await new Promise((resolve) => setTimeout(resolve, Math.min(500, token.waitMs)))
    }
    const { day, resetsAt } = await today()
    const price = vendorPriceUsd(endpoint, overrides)
    const micros = price == null ? 0 : usdToMicros(price)
    const unpriced = price == null ? 1 : 0
    if (limits.quota <= 0) throw new MeterStop('quota', resetsAt.toISOString())
    await env.db.query(
      `INSERT INTO ingest_source_usage (source, day, calls) VALUES ($1,$2,0) ON CONFLICT (source, day) DO NOTHING`,
      [source, day],
    )
    const reserved = await env.db.query(
      `UPDATE ingest_source_usage
          SET calls = calls + 1, cost_micros = cost_micros + $4, requests = requests + 1, unpriced_calls = unpriced_calls + $6
        WHERE source = $1 AND day = $2 AND calls < $3 AND ($5::bigint IS NULL OR cost_micros + $4 <= $5)
        RETURNING calls`,
      [source, day, limits.quota, micros, budgetMicros, unpriced],
    )
    if (!reserved.rowCount) {
      const row = await env.db.query('SELECT calls FROM ingest_source_usage WHERE source = $1 AND day = $2', [source, day])
      const reason = Number(row.rows[0]?.calls ?? 0) >= limits.quota ? 'quota' : 'budget'
      throw new MeterStop(reason, resetsAt.toISOString())
    }
    await env.db.query(
      `UPDATE ingest_jobs SET quota_used = quota_used + 1, cost_micros = cost_micros + $2, vendor_requests = vendor_requests + 1
        WHERE id = $1`,
      [jobId, micros],
    )
    totals.calls += 1
    totals.costMicros += micros
    totals.requests += 1

    let settled = false
    return {
      async settle(result: CallSettlement) {
        if (settled) return
        settled = true
        const refund = result.outcome === 'unbilled'
        const empty = result.empty && !refund ? 1 : 0
        const maybe = result.outcome === 'maybe' ? 1 : 0
        if (refund || empty || maybe) {
          await env.db.query(
            `UPDATE ingest_source_usage
                SET calls = GREATEST(0, calls - $3), cost_micros = GREATEST(0, cost_micros - $4),
                    unbilled = unbilled + $3, empty_results = empty_results + $5, maybe_billed = maybe_billed + $6,
                    unpriced_calls = GREATEST(0, unpriced_calls - $7)
              WHERE source = $1 AND day = $2`,
            [source, day, refund ? 1 : 0, refund ? micros : 0, empty, maybe, refund ? unpriced : 0],
          )
          await env.db.query(
            `UPDATE ingest_jobs SET quota_used = GREATEST(0, quota_used - $2), cost_micros = GREATEST(0, cost_micros - $3),
                empty_count = empty_count + $4 WHERE id = $1`,
            [jobId, refund ? 1 : 0, refund ? micros : 0, empty],
          )
        }
        if (refund) {
          totals.calls -= 1
          totals.costMicros -= micros
        }
        totals.empties += empty
        totals.maybe += maybe
        logEvent(result.outcome === 'billed' ? 'info' : 'warn', 'vendor.call', {
          source,
          jobId,
          endpoint,
          status: result.status,
          requestId: result.requestId,
          outcome: result.outcome,
          empty: Boolean(result.empty),
          costUsd: refund ? 0 : micros / 1_000_000,
          ms: result.ms,
        })
      },
    }
  }

  return { acquire, totals }
}
