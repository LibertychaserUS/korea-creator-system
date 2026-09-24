import { randomUUID } from 'node:crypto'
import { DEFAULT_QUOTA_TIME_ZONE, SOURCE_IDS, type SourceId, type SourceQuery } from '@kcs/contract'
import { getAdapter } from '../adapters'
import type { AppEnv } from '../http/types'
import { logEvent } from '../log'
import { ensureSource } from './jobs'
import { outcomeEvents } from './outcome-events'
import { refreshModelConfig, type RefreshModelConfig } from './refresh-model'

/**
 * Two ways to spend a source's daily calls:
 *
 * - refresh: re-fetch creators we already have, by external id, when their
 *   Poisson change model says a change is likely (`creator_sources.next_refresh_at`,
 *   set on every write, see `./refresh-model`); creators in use (published,
 *   assigned, shortlisted) go first;
 * - discovery: run the saved searches (`ingest_discovery_searches`) that are due.
 *
 * The split is learnt with Thompson sampling on two Beta–Bernoulli arms:
 *   refresh  success = the refreshed numbers moved materially and the creator is in use
 *   discovery success = a creator a discovery job brought in was later published / assigned / shortlisted
 * Each arm's posterior is Beta(1 + successes, 1 + failures) over a recent window;
 * the refresh share is P(θ_refresh ≥ θ_discovery) by Monte-Carlo (probability
 * matching, the batch form of Thompson sampling), held to
 * [refreshMin, 1 − discoveryMin]. Until both arms have `minTrials` trials the
 * split is the starting 70 / 30.
 *
 * The plan is always computed and stored (`ingest_scheduler_state`) so ops can
 * see what it would do; jobs are only enqueued when `INGEST_SCHEDULER=1`,
 * because they spend vendor money.
 */
export type SchedulerConfig = {
  enqueue: boolean
  /** Part of each source's daily quota the scheduler may plan (the rest is left for people). */
  budgetShare: number
  refreshMin: number
  discoveryMin: number
  startRefreshShare: number
  minTrials: number
  refreshWindowDays: number
  discoveryWindowDays: number
  /** Ids per refresh job (one page). */
  idsPerJob: number
  /** Vendor calls one refreshed creator costs (蒲公英: detail + 4 data calls). */
  callsPerRefresh: Record<SourceId, number>
  samples: number
  refresh: RefreshModelConfig
}

function num(value: string | undefined, fallback: number, ok: (n: number) => boolean) {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) && ok(n) ? n : fallback
}

export function schedulerConfig(source: NodeJS.ProcessEnv = process.env): SchedulerConfig {
  const refreshMin = num(source.SCHEDULER_REFRESH_MIN, 0.5, (n) => n >= 0 && n <= 1)
  const discoveryMin = num(source.SCHEDULER_DISCOVERY_MIN, 0.1, (n) => n >= 0 && n <= 1 - refreshMin)
  return {
    enqueue: source.INGEST_SCHEDULER === '1',
    budgetShare: num(source.SCHEDULER_BUDGET_SHARE, 0.8, (n) => n > 0 && n <= 1),
    refreshMin,
    discoveryMin,
    startRefreshShare: num(source.SCHEDULER_START_REFRESH_SHARE, 0.7, (n) => n >= refreshMin && n <= 1 - discoveryMin),
    minTrials: num(source.SCHEDULER_MIN_TRIALS, 30, (n) => n >= 0),
    refreshWindowDays: 30,
    discoveryWindowDays: 60,
    idsPerJob: 20,
    callsPerRefresh: { pugongying: 5, qiangua: 1, xinhong: 1 },
    samples: 4000,
    refresh: refreshModelConfig(source),
  }
}

export type Arm = { trials: number; successes: number; alpha: number; beta: number; mean: number }

function arm(trials: number, successes: number): Arm {
  const alpha = 1 + successes
  const beta = 1 + Math.max(0, trials - successes)
  return { trials, successes, alpha, beta, mean: alpha / (alpha + beta) }
}

/** Marsaglia–Tsang gamma sampler (shape ≥ 1 here, since α, β ≥ 1). */
function sampleGamma(shape: number, random: () => number): number {
  if (shape < 1) return sampleGamma(shape + 1, random) * Math.pow(random(), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      // Box–Muller normal.
      const u1 = Math.max(random(), 1e-12)
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * random())
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = random()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

export function sampleBeta(alpha: number, beta: number, random: () => number = Math.random): number {
  const x = sampleGamma(alpha, random)
  const y = sampleGamma(beta, random)
  return x / (x + y)
}

/** Small seeded generator so a plan can be reproduced in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export type Split = {
  method: 'start' | 'thompson'
  refreshShare: number
  discoveryShare: number
  /** P(θ_refresh ≥ θ_discovery) before clamping; null while on the starting split. */
  winProbability: number | null
}

export function allocate(refresh: Arm, discovery: Arm, config: SchedulerConfig, random: () => number = Math.random): Split {
  const clamp = (share: number) => Math.min(1 - config.discoveryMin, Math.max(config.refreshMin, share))
  if (refresh.trials < config.minTrials || discovery.trials < config.minTrials) {
    const share = clamp(config.startRefreshShare)
    return { method: 'start', refreshShare: share, discoveryShare: 1 - share, winProbability: null }
  }
  let wins = 0
  for (let i = 0; i < config.samples; i += 1) {
    if (sampleBeta(refresh.alpha, refresh.beta, random) >= sampleBeta(discovery.alpha, discovery.beta, random)) wins += 1
  }
  const p = wins / config.samples
  const share = clamp(p)
  return { method: 'thompson', refreshShare: share, discoveryShare: 1 - share, winProbability: p }
}

const IN_USE = `(c.status = 'released'
  OR EXISTS (SELECT 1 FROM assignments a WHERE a.creator_id = c.id)
  OR EXISTS (SELECT 1 FROM shortlist_items s WHERE s.creator_id = c.id))`

export async function measureArms(env: AppEnv, config: SchedulerConfig): Promise<{ refresh: Arm; discovery: Arm }> {
  const now = env.now()
  const refreshSince = new Date(now.getTime() - config.refreshWindowDays * 86_400_000)
  const discoverySince = new Date(now.getTime() - config.discoveryWindowDays * 86_400_000)
  const refresh = await env.db.query(
    `SELECT count(*)::int AS trials,
            count(*) FILTER (WHERE h.material_change AND ${IN_USE})::int AS successes
       FROM creator_metrics_history h
       JOIN ingest_jobs j ON j.id = h.job_id
       JOIN creators c ON c.id = h.creator_id
      WHERE j.schedule = 'refresh' AND h.fetched_at >= $1 AND h.material_change IS NOT NULL`,
    [refreshSince],
  )
  const discovered = await env.db.query(
    `SELECT c.id FROM creators c JOIN ingest_jobs j ON j.id = c.first_ingest_job_id
      WHERE j.schedule = 'discovery' AND c.created_at >= $1`,
    [discoverySince],
  )
  const ids = discovered.rows.map((row) => row.id as string)
  const events = ids.length ? await outcomeEvents(env.db, { creatorIds: ids }) : []
  const useful = new Set(events.filter((e) => e.kind === 'publish' || e.kind === 'assign' || e.kind === 'shortlist').map((e) => e.creatorId))
  return {
    refresh: arm(Number(refresh.rows[0]?.trials ?? 0), Number(refresh.rows[0]?.successes ?? 0)),
    discovery: arm(ids.length, useful.size),
  }
}

export type SourcePlan = {
  source: SourceId
  quota: number
  usedToday: number
  budget: number
  refreshCalls: number
  discoveryCalls: number
  dueCreators: number
  refreshIds: number
  refreshJobs: string[]
  discoveryJobs: { searchId: string; pages: number; jobId: string | null }[]
  skipped: string | null
}

export type SchedulerState = {
  plannedAt: string
  enqueue: boolean
  split: Split
  arms: { refresh: Arm; discovery: Arm }
  sources: SourcePlan[]
  config: Omit<SchedulerConfig, 'samples'>
}

async function usedToday(env: AppEnv, source: SourceId): Promise<number> {
  const { rows } = await env.db.query(
    `SELECT u.calls FROM ingest_source_usage u
       JOIN ingest_sources s ON s.id = u.source
      WHERE u.source = $1 AND u.day = ($2::timestamptz AT TIME ZONE COALESCE(s.quota_tz, $3))::date`,
    [source, env.now(), DEFAULT_QUOTA_TIME_ZONE],
  )
  return Number(rows[0]?.calls ?? 0)
}

async function enqueue(env: AppEnv, schedule: 'refresh' | 'discovery', query: SourceQuery, maxPages: number): Promise<string> {
  const id = randomUUID()
  await env.db.query(
    `INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, sample_rate, opened_by, query, cursor, max_pages)
     VALUES ($1,$2,$3,'queued',0,1,'scheduler',$4,$5,$6)`,
    [id, query.source, schedule, JSON.stringify(query), query.cursor ?? null, Math.max(1, Math.min(100, maxPages))],
  )
  return id
}

async function planSource(env: AppEnv, source: SourceId, split: Split, config: SchedulerConfig): Promise<SourcePlan> {
  const plan: SourcePlan = {
    source, quota: 0, usedToday: 0, budget: 0, refreshCalls: 0, discoveryCalls: 0,
    dueCreators: 0, refreshIds: 0, refreshJobs: [], discoveryJobs: [], skipped: null,
  }
  const adapter = env.getAdapter?.(source) ?? getAdapter(source)
  if (!adapter) return { ...plan, skipped: 'no_adapter' }
  await ensureSource(env, source)
  const row = (await env.db.query('SELECT enabled, quota FROM ingest_sources WHERE id = $1', [source])).rows[0]
  plan.quota = Math.max(0, Number(row?.quota ?? 0))
  if (row?.enabled === false || plan.quota === 0) return { ...plan, skipped: 'paused' }
  const pending = await env.db.query(
    `SELECT 1 FROM ingest_jobs WHERE source_id = $1 AND schedule IN ('refresh','discovery')
       AND status IN ('queued','running','partial') LIMIT 1`,
    [source],
  )
  if (pending.rowCount) return { ...plan, skipped: 'previous_plan_running' }
  plan.usedToday = await usedToday(env, source)
  plan.budget = Math.max(0, Math.floor(plan.quota * config.budgetShare) - plan.usedToday)
  if (plan.budget === 0) return { ...plan, skipped: 'no_budget' }

  const now = env.now()
  const searches = (await env.db.query(
    `SELECT id, query, max_pages FROM ingest_discovery_searches
      WHERE source = $1 AND enabled
        AND (last_enqueued_at IS NULL OR last_enqueued_at + make_interval(hours => every_hours) <= $2)
      ORDER BY last_enqueued_at NULLS FIRST, created_at`,
    [source, now],
  )).rows
  plan.discoveryCalls = searches.length ? Math.max(1, Math.floor(plan.budget * split.discoveryShare)) : 0
  plan.refreshCalls = plan.budget - plan.discoveryCalls

  const canRefresh = adapter.supports.includes('externalIds')
  const cost = Math.max(1, config.callsPerRefresh[source] ?? 1)
  const due = canRefresh
    ? (await env.db.query(
        `SELECT cs.external_id FROM creator_sources cs JOIN creators c ON c.id = cs.creator_id
          WHERE cs.source = $1 AND (cs.next_refresh_at IS NULL OR cs.next_refresh_at <= $2)
          ORDER BY ${IN_USE} DESC, cs.next_refresh_at NULLS FIRST, cs.external_id`,
        [source, now],
      )).rows.map((r) => r.external_id as string)
    : []
  plan.dueCreators = due.length
  const ids = due.slice(0, Math.floor(plan.refreshCalls / cost))
  plan.refreshIds = ids.length
  // What refresh cannot use goes to discovery, and the other way round.
  let discoveryLeft = plan.discoveryCalls + (plan.refreshCalls - ids.length * cost)

  for (let i = 0; i < ids.length; i += config.idsPerJob) {
    const chunk = ids.slice(i, i + config.idsPerJob)
    const query: SourceQuery = { source, window: 30, externalIds: chunk, limit: chunk.length }
    plan.refreshJobs.push(config.enqueue ? await enqueue(env, 'refresh', query, 1) : `dry-run-${i / config.idsPerJob + 1}`)
  }
  for (const search of searches) {
    if (discoveryLeft <= 0) break
    const pages = Math.min(Number(search.max_pages ?? 1), discoveryLeft)
    discoveryLeft -= pages
    const saved = (search.query ?? {}) as Partial<SourceQuery>
    const query: SourceQuery = { ...saved, source, window: saved.window === 90 ? 90 : 30, cursor: null }
    delete query.externalIds
    let jobId: string | null = null
    if (config.enqueue) {
      jobId = await enqueue(env, 'discovery', query, pages)
      await env.db.query('UPDATE ingest_discovery_searches SET last_enqueued_at = $2, updated_at = now() WHERE id = $1', [search.id, now])
    }
    plan.discoveryJobs.push({ searchId: search.id, pages, jobId })
  }
  return plan
}

/** Daily task `scheduler`: measure, split, plan every source, store the state. */
export async function runScheduler(
  env: AppEnv,
  config: SchedulerConfig = schedulerConfig(),
  random: () => number = Math.random,
): Promise<SchedulerState> {
  const arms = await measureArms(env, config)
  const split = allocate(arms.refresh, arms.discovery, config, random)
  const sources: SourcePlan[] = []
  for (const source of SOURCE_IDS) sources.push(await planSource(env, source, split, config))
  const { samples: _samples, ...shown } = config
  const state: SchedulerState = { plannedAt: env.now().toISOString(), enqueue: config.enqueue, split, arms, sources, config: shown }
  await env.db.query(
    `INSERT INTO ingest_scheduler_state (id, planned_at, state) VALUES ('default', $1, $2)
     ON CONFLICT (id) DO UPDATE SET planned_at = EXCLUDED.planned_at, state = EXCLUDED.state`,
    [env.now(), JSON.stringify(state)],
  )
  logEvent('info', 'scheduler.planned', {
    enqueue: config.enqueue,
    method: split.method,
    refreshShare: split.refreshShare,
    jobs: sources.reduce((n, s) => n + s.refreshJobs.length + s.discoveryJobs.length, 0),
  })
  return state
}

export async function readSchedulerState(env: AppEnv): Promise<SchedulerState | null> {
  const { rows } = await env.db.query("SELECT state FROM ingest_scheduler_state WHERE id = 'default'")
  return (rows[0]?.state as SchedulerState | undefined) ?? null
}
