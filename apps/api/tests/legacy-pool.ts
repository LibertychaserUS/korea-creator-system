/**
 * The pool evaluated in memory straight from `creators`, as a test oracle: the
 * SQL paths (which read the `creator_published` projection) must return the
 * same rows, order, tiers, cohorts and percentiles. Groups and ranks come from
 * the contract engine (`rankGroup` / `rankAgainst`) with the stored per-source
 * sample targets.
 */
import {
  applySavedQuery,
  COHORT_RULES,
  cohortGroupKey,
  isStale,
  METRIC_KEYS,
  normalizeHealth,
  rankAgainst,
  rankGroup,
  tierOf,
  type CohortMember,
  type CreatorMetrics,
  type MetricPercentiles,
  type NumericMetricKey,
  type SavedQuery,
  type SourceId,
} from '@kcs/contract'
import type { Db } from '../src/db'
import { asPublished, attachCreatorMeta } from '../src/http/creators'
import { loadTargets, sourceKey } from '../src/http/published'

export type Targets = Map<string, number>

function groupOf(item: Record<string, any>): string {
  const metrics = item.metrics as CreatorMetrics
  return cohortGroupKey({ source: item.source ?? null, window: metrics.window, contentForm: metrics.contentForm ?? null })
}

function memberOf(item: Record<string, any>, now: Date): CohortMember {
  const metrics = item.metrics as CreatorMetrics
  return { id: String(item.id), followers: metrics.followers, metrics, stale: isStale(item.snapshotFetchedAt, now) }
}

export function targetOf(targets: Targets) {
  return (source: string | null) => targets.get(sourceKey(source)) ?? COHORT_RULES.analyticSample
}

export function enrichPoolItems(
  items: Array<Record<string, any>>,
  cohortItems: Array<Record<string, any>>,
  targets: Targets,
  now = new Date(),
): Array<Record<string, any>> {
  const groups = new Map<string, CohortMember[]>()
  for (const item of cohortItems) {
    const key = groupOf(item)
    groups.set(key, [...(groups.get(key) ?? []), memberOf(item, now)])
  }
  const target = targetOf(targets)
  const ranked = new Map<string, MetricPercentiles>()
  for (const members of groups.values()) {
    const source = cohortItems.find((item) => item.id === members[0].id)?.source ?? null
    for (const [id, ranks] of rankGroup(members, { target: target(source) })) ranked.set(id, ranks)
  }
  return items.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    const tier = tierOf(metrics.followers)
    const members = groups.get(groupOf(item)) ?? []
    const member = memberOf(item, now)
    const percentiles = member.stale
      ? {}
      : ranked.get(member.id) ?? rankAgainst(members, member, { target: target(item.source ?? null) })
    return {
      ...item,
      followers: metrics.followers,
      tier,
      cohort: { source: item.source ?? null, tier, size: members.length, window: metrics.window, contentForm: metrics.contentForm ?? null },
      metrics,
      percentiles,
      stale: member.stale,
    }
  })
}

export function queryRow(item: Record<string, any>) {
  return {
    id: String(item.id),
    creatorKey: String(item.creatorKey),
    displayName: String(item.displayName),
    source: item.source as SourceId,
    regions: item.regions as string[],
    coopBrands: [...new Set([
      ...(item.metrics.coopBrands ?? []),
      ...(item.collabBrands ?? []),
    ])] as string[],
    metrics: item.metrics as CreatorMetrics,
    stale: isStale(item.snapshotFetchedAt, new Date()),
  }
}

export function publicQueryResultRow(item: Record<string, any>) {
  return { ...item, health: item.metrics.health, stale: Boolean(item.stale) }
}

export async function queryPool(db: Db, query: Record<string, string>) {
  const { rows } = await db.query("SELECT * FROM creators WHERE status = 'released'")
  const visible = (await attachCreatorMeta(db, rows, false))
    .filter((item) => !item.categories.includes('blacklist'))
    .map(asPublished)
  let items = enrichPoolItems(visible, visible, await loadTargets(db))
  if (query.hasCollaborated === 'true') items = items.filter((item) => item.hasCollaborated)
  if (query.hasCollaborated === 'false') items = items.filter((item) => !item.hasCollaborated)
  if (query.priceMin || query.priceMax) {
    const min = query.priceMin ? Number(query.priceMin) : 0
    const max = query.priceMax ? Number(query.priceMax) : Number.MAX_SAFE_INTEGER
    items = items.filter((item) => {
      if (!item.price) return false
      const low = item.price.amountMin ?? item.price.amountMax ?? 0
      const high = item.price.amountMax ?? item.price.amountMin ?? low
      if (query.currency) {
        if (item.price.currency !== query.currency) return false
        return low <= max && high >= min
      }
      const rate = item.price.currency === 'CNY' ? 1 : item.price.fxToCny
      if (rate == null) return false
      return low * rate <= max && high * rate >= min
    })
  }
  for (const field of ['categories', 'category', 'verticals'] as const) {
    if (!query[field]) continue
    const wanted = query[field].split(',')
    items = items.filter((item) => {
      if (field === 'categories') return wanted.some((value) => item.categories.includes(value))
      if (field === 'category') {
        return wanted.some((value) => item.categories.includes(value) || item.verticals.includes(value))
      }
      return wanted.some((value) => item.verticals.includes(value))
    })
  }
  if (query.collabCountMin) {
    items = items.filter((item) => item.collabCount >= Number(query.collabCountMin))
  }
  if (query.collabCountMax) {
    items = items.filter((item) => item.collabCount <= Number(query.collabCountMax))
  }
  for (const field of ['tier', 'health', 'source'] as const) {
    if (!query[field]) continue
    const wanted = query[field].split(',')
      .map((value) => (field === 'health' ? normalizeHealth(value, null, null).health ?? value : value))
    items = items.filter((item) => {
      const value = field === 'health' ? item.metrics.health : item[field]
      return value != null && wanted.includes(value)
    })
  }
  if (query.region) {
    const wanted = query.region.split(',').map((value) => value.toLowerCase())
    items = items.filter((item) =>
      item.regions.some((region: string) =>
        wanted.some((value) => region.toLowerCase().includes(value))),
    )
  }
  if (query.brand) {
    const wanted = query.brand.split(',').map((value) => value.toLowerCase()).filter(Boolean)
    items = items.filter((item) => {
      const text = [
        ...(item.collabBrands || []),
        ...(item.verticals || []),
        item.displayName,
        ...(item.categories || []),
      ].join(' ').toLowerCase()
      return wanted.some((value) => text.includes(value))
    })
  }
  if (query.q) {
    const needle = query.q.toLowerCase()
    items = items.filter((item) =>
      [item.displayName, item.creatorKey, ...item.regions, ...item.verticals, ...item.collabBrands]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }
  for (const key of METRIC_KEYS) {
    const min = query[`${key}Min`]
    const max = query[`${key}Max`]
    if (min != null && min !== '') {
      items = items.filter((item) => item.metrics[key] != null && item.metrics[key] >= Number(min))
    }
    if (max != null && max !== '') {
      items = items.filter((item) => item.metrics[key] != null && item.metrics[key] <= Number(max))
    }
  }
  const sort = query.sort === 'followers' || METRIC_KEYS.includes(query.sort as NumericMetricKey)
    ? query.sort as NumericMetricKey
    : 'cpe'
  const order = (query.order ?? (sort === 'cpe' ? 'asc' : 'desc')) === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const left = a.metrics[sort]
    const right = b.metrics[sort]
    if (left == null && right == null) return compareFollowersDesc(a, b)
    if (left == null) return 1
    if (right == null) return -1
    if (left !== right) return (left - right) * order
    return compareFollowersDesc(a, b)
  })
  return items
}

function compareFollowersDesc(left: Record<string, any>, right: Record<string, any>) {
  if (left.followers == null && right.followers == null) return 0
  if (left.followers == null) return 1
  if (right.followers == null) return -1
  return right.followers - left.followers
}

export async function legacyRun(db: Db, spec: SavedQuery) {
  const pool = await queryPool(db, {})
  const targets = await loadTargets(db)
  return applySavedQuery(pool.map(queryRow), spec, { target: targetOf(targets) }).map(publicQueryResultRow)
}
