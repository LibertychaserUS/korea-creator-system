import {
  CREATOR_TIERS,
  tierOf,
  type CreatorTrends,
  type FollowerSlope,
  type MetricSnapshot,
  type SourceId,
  type TrendHint,
  type TrendLocale,
  type TrendSeries,
} from '@kcs/contract'
import { parseMetrics } from '../http/creators'
import type { AppEnv } from '../http/types'

/**
 * Trends per source (never one line across sources: 蒲公英 68 万 and 千瓜 53 万
 * on one line would read as a 22% loss), the log-follower slope, and
 * plain-language hints. Hints are for a human to look at; nothing ranks on them.
 */
export type TrendConfig = {
  /** Adjacent snapshots at most `jumpMaxDays` apart whose followers moved by ≥ this share. */
  jumpRatio: number
  jumpMaxDays: number
  /** Engagement rate ≥ factor × the median of the same source / tier / window … */
  outlierFactor: number
  /** … among at least this many creators. */
  outlierMinGroup: number
  /** Over ≥ `divergeMinDays`: followers up by ≥ `divergeFollowers` while median interactions fell by ≥ `divergeInteractions`. */
  divergeFollowers: number
  divergeInteractions: number
  divergeMinDays: number
  slopeMinPoints: number
  slopeMinDays: number
}

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  jumpRatio: 0.2,
  jumpMaxDays: 14,
  outlierFactor: 3,
  outlierMinGroup: 30,
  divergeFollowers: 0.05,
  divergeInteractions: 0.2,
  divergeMinDays: 14,
  slopeMinPoints: 3,
  slopeMinDays: 7,
}

export function trendConfig(source: NodeJS.ProcessEnv = process.env): TrendConfig {
  if (!source.TREND_CONFIG) return { ...DEFAULT_TREND_CONFIG }
  try {
    const parsed = JSON.parse(source.TREND_CONFIG) as Record<string, unknown>
    const config = { ...DEFAULT_TREND_CONFIG }
    for (const key of Object.keys(config) as (keyof TrendConfig)[]) {
      const value = Number(parsed[key])
      if (parsed[key] != null && Number.isFinite(value) && value > 0) config[key] = value
    }
    return config
  } catch {
    return { ...DEFAULT_TREND_CONFIG }
  }
}

const DAY_MS = 86_400_000

export function logFollowerSlope(
  points: ReadonlyArray<{ fetchedAt: string | Date; followers: number | null | undefined }>,
  config: Pick<TrendConfig, 'slopeMinPoints' | 'slopeMinDays'> = DEFAULT_TREND_CONFIG,
): FollowerSlope | null {
  const usable = points
    .filter((point) => typeof point.followers === 'number' && point.followers > 0)
    .map((point) => ({ t: new Date(point.fetchedAt).getTime(), y: Math.log(point.followers as number) }))
    .sort((a, b) => a.t - b.t)
  if (usable.length < config.slopeMinPoints) return null
  const t0 = usable[0]!.t
  const xs = usable.map((point) => (point.t - t0) / DAY_MS)
  const spanDays = xs[xs.length - 1]!
  if (spanDays < config.slopeMinDays) return null
  const n = usable.length
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n
  const meanY = usable.reduce((sum, point) => sum + point.y, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  usable.forEach((point, i) => {
    const dx = xs[i]! - meanX
    const dy = point.y - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  })
  if (sxx === 0) return null
  // Rounding noise on identical values is a flat line, not a poor fit.
  const flat = syy < 1e-12
  const perDay = flat ? 0 : sxy / sxx
  return {
    perDay,
    growth30d: Math.expm1(30 * perDay),
    r2: flat ? null : (sxy * sxy) / (sxx * syy),
    points: n,
    spanDays: Math.round(spanDays * 10) / 10,
  }
}

type Point = { fetchedAt: string; followers: number | null; interactionMedian: number | null }

const LOCALES: TrendLocale[] = ['zh-CN', 'en', 'ko']
const pct = (ratio: number) => `${Math.round(Math.abs(ratio) * 100)}%`
const num = (value: number, locale: TrendLocale) => new Intl.NumberFormat(locale).format(Math.round(value))
const beijingDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10)

function messages(build: (locale: TrendLocale) => string): Record<TrendLocale, string> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, build(locale)])) as Record<TrendLocale, string>
}

/** Sudden follower moves and "followers up, interactions down" within one source. */
export function seriesHints(source: SourceId, points: readonly Point[], config: TrendConfig = DEFAULT_TREND_CONFIG): TrendHint[] {
  const hints: TrendHint[] = []
  type Move = { ratio: number; from: Point; to: Point; days: number }
  let jump = null as Move | null
  let drop = null as Move | null
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]!
    const to = points[i]!
    if (!from.followers || to.followers == null || from.followers <= 0) continue
    const days = (new Date(to.fetchedAt).getTime() - new Date(from.fetchedAt).getTime()) / DAY_MS
    if (days <= 0 || days > config.jumpMaxDays) continue
    const ratio = (to.followers - from.followers) / from.followers
    if (ratio >= config.jumpRatio && (!jump || ratio >= jump.ratio)) jump = { ratio, from, to, days }
    if (ratio <= -config.jumpRatio && (!drop || ratio <= drop.ratio)) drop = { ratio, from, to, days }
  }
  for (const [kind, move] of [['follower_jump', jump], ['follower_drop', drop]] as const) {
    if (!move) continue
    const date = beijingDay(move.to.fetchedAt)
    const days = Math.max(1, Math.round(move.days))
    const from = move.from.followers!
    const to = move.to.followers!
    hints.push({
      kind,
      source,
      params: { date, days, ratio: Number(move.ratio.toFixed(4)), from, to },
      messages: kind === 'follower_jump'
        ? messages((l) => ({
            'zh-CN': `${date} 前后 ${days} 天内粉丝涨了 ${pct(move.ratio)}（${num(from, l)} → ${num(to, l)}），可以看看是否有投放或活动`,
            en: `Followers rose ${pct(move.ratio)} in ${days} days around ${date} (${num(from, l)} → ${num(to, l)}) — worth checking for promotion or a campaign`,
            ko: `${date} 전후 ${days}일 만에 팔로워가 ${pct(move.ratio)} 늘었습니다(${num(from, l)} → ${num(to, l)}). 광고나 이벤트가 있었는지 확인해 보세요`,
          })[l])
        : messages((l) => ({
            'zh-CN': `${date} 前后 ${days} 天内粉丝掉了 ${pct(move.ratio)}（${num(from, l)} → ${num(to, l)}），可能有清理或异常`,
            en: `Followers fell ${pct(move.ratio)} in ${days} days around ${date} (${num(from, l)} → ${num(to, l)}) — possibly a clean-up or something wrong`,
            ko: `${date} 전후 ${days}일 만에 팔로워가 ${pct(move.ratio)} 줄었습니다(${num(from, l)} → ${num(to, l)}). 정리나 이상이 있었을 수 있습니다`,
          })[l]),
    })
  }

  const withBoth = points.filter((point) => point.followers && point.followers > 0 && point.interactionMedian && point.interactionMedian > 0)
  if (withBoth.length >= 2) {
    const first = withBoth[0]!
    const last = withBoth[withBoth.length - 1]!
    const days = (new Date(last.fetchedAt).getTime() - new Date(first.fetchedAt).getTime()) / DAY_MS
    const followers = last.followers! / first.followers! - 1
    const interactions = last.interactionMedian! / first.interactionMedian! - 1
    if (days >= config.divergeMinDays && followers >= config.divergeFollowers && interactions <= -config.divergeInteractions) {
      const span = Math.round(days)
      hints.push({
        kind: 'followers_up_engagement_down',
        source,
        params: { days: span, followers: Number(followers.toFixed(4)), interactions: Number(interactions.toFixed(4)) },
        messages: messages((l) => ({
          'zh-CN': `近 ${span} 天粉丝涨了 ${pct(followers)}，互动却降了 ${pct(interactions)}`,
          en: `Over ${span} days followers grew ${pct(followers)} while interactions fell ${pct(interactions)}`,
          ko: `최근 ${span}일 동안 팔로워는 ${pct(followers)} 늘었지만 반응은 ${pct(interactions)} 줄었습니다`,
        })[l]),
      })
    }
  }
  return hints
}

export function engagementOutlierHint(
  source: SourceId,
  value: number | null,
  group: { median: number | null; size: number },
  config: TrendConfig = DEFAULT_TREND_CONFIG,
): TrendHint | null {
  if (value == null || !group.median || group.median <= 0 || group.size < config.outlierMinGroup) return null
  const factor = value / group.median
  if (factor < config.outlierFactor) return null
  const shown = factor.toFixed(1)
  return {
    kind: 'engagement_outlier',
    source,
    params: { factor: Number(shown), value, median: group.median, groupSize: group.size },
    messages: messages((l) => ({
      'zh-CN': `互动率是同量级博主一般水平的 ${shown} 倍（本库 ${group.size} 人），明显偏高，建议核实`,
      en: `Engagement is ${shown}× what similar-size creators usually get (${group.size} in our library) — unusually high, worth checking`,
      ko: `참여율이 비슷한 규모 크리에이터의 보통 수준보다 ${shown}배 높습니다(자체 DB ${group.size}명). 확인해 보세요`,
    })[l]),
  }
}

function tierBounds(followers: number | null) {
  const tier = tierOf(followers)
  const index = CREATOR_TIERS.findIndex((candidate) => candidate.id === tier)
  return { min: CREATOR_TIERS[index]!.min, max: index > 0 ? CREATOR_TIERS[index - 1]!.min : null }
}

/** Median engagement of the same source, window and follower tier (latest numbers). */
async function peerEngagement(env: AppEnv, source: SourceId, window: number, followers: number | null) {
  const { min, max } = tierBounds(followers)
  const { rows } = await env.db.query(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (metrics->>'engagementRate')::float8) AS median, count(*)::int AS size
       FROM creators
      WHERE source = $1 AND metrics_window = $2 AND followers >= $3 AND ($4::int IS NULL OR followers < $4)
        AND jsonb_typeof(metrics->'engagementRate') = 'number'`,
    [source, window, min, max],
  )
  return { median: rows[0]?.median == null ? null : Number(rows[0].median), size: Number(rows[0]?.size ?? 0) }
}

export async function creatorTrends(
  env: AppEnv,
  creatorId: string,
  query: { window?: string | number; source?: string; limit?: string | number } = {},
  config: TrendConfig = trendConfig(),
): Promise<CreatorTrends | null> {
  const exists = await env.db.query('SELECT 1 FROM creators WHERE id = $1', [creatorId])
  if (!exists.rowCount) return null
  const window = Number(query.window) === 90 ? 90 : 30
  const limit = Math.max(2, Math.min(365, Math.floor(Number(query.limit)) || 90))
  const { rows } = await env.db.query(
    `SELECT * FROM (
       SELECT id, creator_id, source, "window", fetched_at, job_id, metrics,
              row_number() OVER (PARTITION BY source ORDER BY fetched_at DESC) AS recent
         FROM creator_metrics_history
        WHERE creator_id = $1 AND "window" = $2 AND ($3::text IS NULL OR source = $3)
     ) h WHERE recent <= $4
     ORDER BY source, fetched_at`,
    [creatorId, window, query.source || null, limit],
  )
  const bySource = new Map<SourceId, MetricSnapshot[]>()
  for (const row of rows) {
    const metrics = parseMetrics(row.metrics)
    if (!metrics) continue
    const list = bySource.get(row.source) ?? []
    list.push({
      id: row.id,
      creatorId: row.creator_id,
      source: row.source,
      window: Number(row.window) as 30 | 90,
      fetchedAt: row.fetched_at instanceof Date ? row.fetched_at.toISOString() : String(row.fetched_at),
      jobId: row.job_id ?? null,
      metrics,
    })
    bySource.set(row.source, list)
  }

  const series: TrendSeries[] = []
  const hints: TrendHint[] = []
  for (const [source, snapshots] of bySource) {
    const points = snapshots.map((snapshot) => ({
      fetchedAt: snapshot.fetchedAt,
      followers: snapshot.metrics.followers,
      interactionMedian: snapshot.metrics.interactionMedian,
    }))
    series.push({ source, snapshots, followerSlope: logFollowerSlope(points, config) })
    hints.push(...seriesHints(source, points, config))
    const latest = snapshots[snapshots.length - 1]!.metrics
    const outlier = engagementOutlierHint(
      source,
      latest.engagementRate,
      await peerEngagement(env, source, window, latest.followers),
      config,
    )
    if (outlier) hints.push(outlier)
  }
  const primary = [...series].sort((a, b) =>
    b.snapshots.length - a.snapshots.length
    || b.snapshots[b.snapshots.length - 1]!.fetchedAt.localeCompare(a.snapshots[a.snapshots.length - 1]!.fetchedAt))[0]
  return { creatorId, window, primarySource: primary?.source ?? null, series, hints }
}
