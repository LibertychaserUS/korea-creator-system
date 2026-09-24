import { exportUnitValue } from './display-format'
import { metricField, tierOf, type CreatorMetrics, type CreatorTier, type NumericMetricKey } from './metrics'
import { DEFAULT_QUERY_COLUMNS } from './saved-query'
import type { SourceId } from './source-adapter'

/**
 * Project export as a spreadsheet file (CSV with a BOM so Excel opens UTF-8).
 * Lives in the contract because the API image ships only contract + api —
 * the labels here must read the same as `kcs.metric.*` / `kcs.tier.*` in the
 * UI locales (tests/unit/export-labels.test.ts keeps them in step).
 */
export const EXPORT_LOCALES = ['zh-CN', 'en', 'ko'] as const
export type ExportLocale = (typeof EXPORT_LOCALES)[number]

export const EXPORT_METRICS: NumericMetricKey[] = [...DEFAULT_QUERY_COLUMNS]

type ExportLabels = {
  creator: string
  xhsId: string
  source: string
  tier: string
  status: string
  publishedAt: string
  metrics: Partial<Record<NumericMetricKey, string>>
  tiers: Record<CreatorTier, string>
  sources: Record<SourceId | 'manual', string>
  statuses: { assigned: string; withdrawn: string }
}

export const EXPORT_LABELS: Record<ExportLocale, ExportLabels> = {
  'zh-CN': {
    creator: '博主',
    xhsId: '小红书号',
    source: '数据源',
    tier: '粉丝量级',
    status: '状态',
    publishedAt: '发布时间',
    metrics: {
      followers: '粉丝数',
      readMedian: '阅读中位数',
      interactionMedian: '互动中位数',
      engagementRate: '互动率',
      cpe: 'CPE',
      collectLikeRatio: '收藏 / 点赞',
      readToFollowerRatio: '读粉比',
      viralRate: '爆文率',
    },
    tiers: { head: '头部', mid: '腰部', junior: '初级', amateur: '素人', unknown: '未知' },
    sources: { pugongying: '蒲公英', qiangua: '千瓜', xinhong: '新红', manual: '手动录入' },
    statuses: { assigned: '已分派', withdrawn: '已下架' },
  },
  en: {
    creator: 'Creator',
    xhsId: 'Xiaohongshu account',
    source: 'Source',
    tier: 'Follower tier',
    status: 'Status',
    publishedAt: 'Published',
    metrics: {
      followers: 'Followers',
      readMedian: 'Median reads',
      interactionMedian: 'Median interactions',
      engagementRate: 'Engagement rate',
      cpe: 'CPE',
      collectLikeRatio: 'Saves / likes',
      readToFollowerRatio: 'Reads per follower',
      viralRate: 'Viral rate',
    },
    tiers: { head: 'Head', mid: 'Mid', junior: 'Junior', amateur: 'Amateur', unknown: 'Unknown' },
    sources: { pugongying: 'Pugongying', qiangua: 'Qiangua', xinhong: 'Xinhong', manual: 'Added by hand' },
    statuses: { assigned: 'Assigned', withdrawn: 'Withdrawn' },
  },
  ko: {
    creator: '크리에이터',
    xhsId: '샤오홍슈 계정',
    source: '데이터 소스',
    tier: '팔로워 구간',
    status: '상태',
    publishedAt: '게시일',
    metrics: {
      followers: '팔로워',
      readMedian: '조회 중앙값',
      interactionMedian: '상호작용 중앙값',
      engagementRate: '참여율',
      cpe: 'CPE',
      collectLikeRatio: '저장 / 좋아요',
      readToFollowerRatio: '팔로워당 조회',
      viralRate: '바이럴 비율',
    },
    tiers: { head: '탑', mid: '미드', junior: '주니어', amateur: '마이크로', unknown: '미분류' },
    sources: { pugongying: '푸궁잉', qiangua: '첸과', xinhong: '신훙', manual: '직접 등록' },
    statuses: { assigned: '배정 완료', withdrawn: '게시 중단' },
  },
}

export function exportLocale(raw: string | null | undefined): ExportLocale {
  return (EXPORT_LOCALES as readonly string[]).includes(raw ?? '') ? (raw as ExportLocale) : 'zh-CN'
}

/** Quote when needed, and defuse text a spreadsheet would run as a formula. A plain negative number stays a number. */
export function exportCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^-\d+(\.\d+)?%?$/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * An identifier that must stay text: a spreadsheet would drop the leading
 * zero of `0123` and round a 17-digit number. Digits only, so the `="…"`
 * wrapper cannot carry a formula.
 */
export function exportTextCell(value: string | null | undefined): string {
  if (value == null) return ''
  if (/^\d+$/.test(value) && (value.startsWith('0') || value.length > 15)) return `"=""${value}"""`
  return exportCell(value)
}

/** Same digits as the screen (see display-format.ts), without grouping or currency sign. */
export function exportMetric(key: NumericMetricKey, value: number | null | undefined): string {
  return exportUnitValue(metricField(key).unit, value)
}

/** Calendar day of `value` in `timeZone` (the team works in Beijing time), `YYYY-MM-DD`. */
export function exportDay(value: string | Date | null | undefined, timeZone = EXPORT_TIME_ZONE): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export const EXPORT_TIME_ZONE = 'Asia/Shanghai'

export type ExportRow = {
  displayName: string | null
  xhsId: string | null
  source: string | null
  followers: number | null
  metrics: Partial<CreatorMetrics> | null
  poolGone: boolean
  metricsLockedAt: string | Date | null
}

export function projectSheet(rows: ExportRow[], locale: ExportLocale = 'zh-CN', timeZone = EXPORT_TIME_ZONE): string {
  const l = EXPORT_LABELS[locale]
  const header = [l.creator, l.xhsId, l.source, l.tier, ...EXPORT_METRICS.map((key) => l.metrics[key] ?? key), l.status, l.publishedAt]
  const lines = rows.map((row) => {
    const metrics = row.metrics ?? {}
    const followers = metrics.followers ?? row.followers
    const source = row.source && row.source in l.sources ? l.sources[row.source as SourceId] : row.source ? row.source : l.sources.manual
    return [
      exportCell(row.displayName),
      exportTextCell(row.xhsId),
      exportCell(source),
      exportCell(l.tiers[tierOf(followers)]),
      ...EXPORT_METRICS.map((key) => exportCell(exportMetric(key, key === 'followers' ? followers : (metrics[key] as number | null | undefined)))),
      exportCell(row.poolGone ? l.statuses.withdrawn : l.statuses.assigned),
      exportCell(exportDay(row.metricsLockedAt, timeZone)),
    ].join(',')
  })
  return `\uFEFF${[header.map(exportCell).join(','), ...lines].join('\r\n')}\r\n`
}
