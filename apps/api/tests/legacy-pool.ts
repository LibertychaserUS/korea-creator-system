/**
 * The in-memory pool the SQL replaced, kept verbatim as a test oracle: the
 * SQL paths must return the same rows, order, tiers, cohorts and percentiles.
 */
import {
  applySavedQuery,
  cohortKey,
  cohortPercentiles,
  METRIC_KEYS,
  tierOf,
  type CreatorMetrics,
  type NumericMetricKey,
  type SavedQuery,
  type SourceId,
} from '@kcs/contract'
import type { Db } from '../src/db'
import { asPublished, attachCreatorMeta } from '../src/http/creators'

export function enrichPoolItems(
  items: Array<Record<string, any>>,
  cohortItems: Array<Record<string, any>> = items,
): Array<Record<string, any>> {
  const byCohort = new Map<string, CreatorMetrics[]>()
  for (const item of cohortItems) {
    if (!item.source) continue
    const metrics = item.metrics as CreatorMetrics
    const tier = tierOf(metrics.followers)
    const key = cohortKey(item.source as SourceId, tier)
    byCohort.set(key, [...(byCohort.get(key) ?? []), metrics])
  }
  return items.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    const tier = tierOf(metrics.followers)
    const key = item.source ? cohortKey(item.source as SourceId, tier) : null
    const cohort = key ? byCohort.get(key) ?? [] : []
    return {
      ...item,
      followers: metrics.followers,
      tier,
      cohort: item.source ? { source: item.source, tier, size: cohort.length } : null,
      metrics,
      percentiles: cohortPercentiles(metrics, cohort),
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
  }
}

export function publicQueryResultRow(item: Record<string, any>) {
  return { ...item, health: item.metrics.health }
}

export async function queryPool(db: Db, query: Record<string, string>) {
  const { rows } = await db.query("SELECT * FROM creators WHERE status = 'released'")
  const visible = (await attachCreatorMeta(db, rows, false))
    .filter((item) => !item.categories.includes('blacklist'))
    .map(asPublished)
  let items = enrichPoolItems(visible, visible)
  if (query.hasCollaborated === 'true') items = items.filter((item) => item.hasCollaborated)
  if (query.hasCollaborated === 'false') items = items.filter((item) => !item.hasCollaborated)
  if (query.priceMin || query.priceMax) {
    const min = query.priceMin ? Number(query.priceMin) : 0
    const max = query.priceMax ? Number(query.priceMax) : Number.MAX_SAFE_INTEGER
    items = items.filter((item) => {
      if (!item.price) return false
      const low = item.price.amountMin ?? item.price.amountMax ?? 0
      const high = item.price.amountMax ?? item.price.amountMin ?? low
      if (query.currency && item.price.currency !== query.currency) return false
      return low <= max && high >= min
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
  return applySavedQuery(pool.map(queryRow), spec).map(publicQueryResultRow)
}
