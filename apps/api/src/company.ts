import type { Db } from './db'
import type { CompanyPrefs } from './imok-pink'

export type CompanyRecord = {
  id: string
  slug: string
  name: string
  prefs: CompanyPrefs
}

export type RulePack = {
  slug: string
  title: string
  dimensions: Array<{ key: string; label: string; options: string[]; thresholdWan?: number }>
}

export async function loadCompany(db: Db, orgId: string): Promise<CompanyRecord | null> {
  const { rows } = await db.query('SELECT id, slug, name, prefs FROM orgs WHERE id = $1', [orgId])
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    prefs: row.prefs || { currency: 'CNY', locale: 'zh-CN', defaultSort: 'rating' },
  }
}

export async function loadRulePack(db: Db, orgId: string): Promise<RulePack | null> {
  const { rows } = await db.query(
    `SELECT slug, title, filters FROM company_rule_packs WHERE org_id = $1 ORDER BY slug LIMIT 1`,
    [orgId],
  )
  const row = rows[0]
  if (!row) return null
  const filters = row.filters || {}
  return {
    slug: row.slug,
    title: row.title,
    dimensions: filters.dimensions || [],
  }
}

export async function loadCollaborators(db: Db, orgId: string) {
  const { rows } = await db.query(
    `SELECT cc.creator_id, cc.outreach, cc.conclusion, cc.source, c.display_name
     FROM company_collaborators cc
     JOIN creators c ON c.id = cc.creator_id
     WHERE cc.org_id = $1
     ORDER BY c.display_name`,
    [orgId],
  )
  return rows.map((row) => ({
    creatorId: row.creator_id,
    displayName: row.display_name,
    outreach: row.outreach,
    conclusion: row.conclusion,
    source: row.source,
  }))
}

export function presentUser(
  user: { id: string; orgId: string; email: string; role: string; displayName: string },
  company: CompanyRecord | null,
) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    companyId: user.orgId,
    orgId: user.orgId,
    company: company
      ? { id: company.id, slug: company.slug, name: company.name, prefs: company.prefs }
      : null,
  }
}

export async function applyCompanyLens<T extends { id: string; hasCollaborated: boolean }>(
  db: Db,
  items: T[],
  orgId: string,
): Promise<
  Array<
    T & {
      advice?: string
      followersBand?: string
      outreach?: string
      koreaRelation?: string
      conclusion?: string
      risk?: string
    }
  >
> {
  if (!items.length) return items
  const ids = items.map((item) => item.id)
  const attrs = await db.query(
    `SELECT * FROM company_creator_attrs WHERE org_id = $1 AND creator_id = ANY($2)`,
    [orgId, ids],
  )
  const collab = await db.query(
    `SELECT creator_id FROM company_collaborators WHERE org_id = $1 AND creator_id = ANY($2)`,
    [orgId, ids],
  )
  const collabIds = new Set(collab.rows.map((row) => row.creator_id))
  const byId = new Map(attrs.rows.map((row) => [row.creator_id, row]))
  return items.map((item) => {
    const row = byId.get(item.id)
    return {
      ...item,
      hasCollaborated: item.hasCollaborated || collabIds.has(item.id),
      advice: row?.advice,
      followersBand: row?.followers_band,
      outreach: row?.outreach,
      koreaRelation: row?.korea_relation,
      conclusion: row?.conclusion,
      risk: row?.risk,
    }
  })
}
