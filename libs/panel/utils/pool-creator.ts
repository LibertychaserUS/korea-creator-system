/**
 * Normalized creator for the 前台 pool: one shape over the live API
 * (`/api/select/pool`) and the IMOK sample summary CSV fixture.
 */

export type CreatorSource = 'api' | 'imok-sample' | 'demo'

export interface PoolCreator {
  id: string
  creatorKey?: string
  displayName: string
  shortName?: string
  platform?: string
  account?: string
  link?: string
  followers?: number
  followersUnknown?: boolean
  region?: string
  content?: string
  verticals?: string[]
  advice?: string
  contact?: string
  korea?: string
  koreaStrength?: string
  conclusion?: string
  risk?: string
  collaborated: boolean
  collabCount?: number
  collabBrands?: string[]
  grade?: string
  final?: number
  label?: string
  price?: { amountMin?: number; amountMax?: number; currency?: string; unit?: string }
  avatarUrl?: string
  photoUrls?: string[]
  source: CreatorSource
}

export function fromApiPool(row: any): PoolCreator {
  return {
    id: String(row.id),
    creatorKey: row.creatorKey,
    displayName: row.displayName || row.creatorKey || '—',
    followers: row.followers != null ? Number(row.followers) : undefined,
    followersUnknown: Boolean(row.followersUnknown),
    region: Array.isArray(row.regions) ? row.regions.join(' / ') : row.regions,
    verticals: row.verticals,
    content: Array.isArray(row.verticals) ? row.verticals.join('、') : undefined,
    collaborated: Boolean(row.hasCollaborated),
    collabCount: row.collabCount,
    collabBrands: row.collabBrands,
    grade: row.grade,
    final: row.final != null ? Number(row.final) : undefined,
    label: row.label,
    price: row.price || undefined,
    avatarUrl: row.avatarUrl || row.avatar_url || undefined,
    photoUrls: row.photoUrls || row.photo_urls || undefined,
    source: 'api',
  }
}

/** IMOK summary row (28 cols). 合作过 is company-scoped: IMOK 实际做过广告. */
export function fromImokSummary(row: Record<string, string>): PoolCreator {
  const verifiedWan = Number(row['当天核实万'] || row['名单粉丝万'] || '')
  const conclusion = row['结论'] || ''
  const advice = row['建议'] || ''
  return {
    id: `imok-${row['排序'] || row['姓名']}`,
    displayName: row['姓名'] || '—',
    shortName: row['短名'] || undefined,
    platform: row['主平台'] || undefined,
    account: row['账号'] || undefined,
    link: row['链接'] || undefined,
    followers: Number.isFinite(verifiedWan) && verifiedWan > 0 ? Math.round(verifiedWan * 10000) : undefined,
    region: row['地区'] || undefined,
    content: row['内容'] || undefined,
    advice: advice || undefined,
    contact: row['对接'] || undefined,
    korea: row['韩国关系'] || undefined,
    koreaStrength: row['韩国强度'] || undefined,
    conclusion: conclusion || undefined,
    risk: row['风险'] || undefined,
    collaborated: conclusion.includes('合作过') || advice.includes('粉色'),
    source: 'imok-sample',
  }
}

export function isRecommended(c: PoolCreator): boolean {
  if (c.source === 'imok-sample') return Boolean(c.advice?.includes('优先'))
  if (c.source === 'api') return (c.final ?? 0) >= 70 || c.label === 'S'
  return (c.final ?? 0) >= 70
}
