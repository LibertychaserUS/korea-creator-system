import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from './db'

export const IMOK_ID = 'org_imok'
export const HANSOUL_ID = 'org_hansoul'
export const PLATFORM_ID = 'org_platform'

export type CompanyPrefs = {
  currency: 'CNY' | 'USD' | 'KRW'
  locale: 'zh-CN' | 'en' | 'ko'
  defaultSort: string
}

export type ImportCounts = { summary: number; detail: number; chart: number }

const SHORT_SLUG: Record<string, string> = {
  沁柔: 'qinrou',
  妄娜: 'wanna',
  くるみ: 'kurumi',
  居猫夫人: 'jumao',
  橘七七: 'ju77',
  久木田: 'honoka',
}

const FILES = {
  summary: 'IMOK-pink-summary.csv',
  detail: 'IMOK-pink-influencer-detail.csv',
  chart: 'IMOK-pink-chart-data.csv',
} as const

function fixtureText(file: string): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const local = join(here, '../fixtures/imok-pink', file)
  try {
    return readFileSync(local, 'utf8')
  } catch (err) {
    const extra = process.env.KCS_IMOK_FIXTURE_DIR
    if (!extra) throw err
    return readFileSync(join(extra, file), 'utf8')
  }
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''))
      if (row.some((cell) => cell.length)) rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''))
    if (row.some((cell) => cell.length)) rows.push(row)
  }
  const header = (rows[0] || []).map((h) => h.trim())
  return rows.slice(1).map((cols) => {
    const item: Record<string, string> = {}
    header.forEach((key, index) => {
      item[key] = (cols[index] ?? '').trim()
    })
    return item
  })
}

export function followersBand(gapWan: number): string {
  if (gapWan >= 0) return '过线'
  if (gapWan >= -10) return '接近'
  return '不够'
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

function creatorIdFor(shortName: string): string {
  return `creator_imok_${SHORT_SLUG[shortName] || shortName}`
}

async function upsertDatasetRow(
  db: Db,
  orgId: string,
  dataset: string,
  rowKey: string,
  payload: Record<string, string>,
) {
  const id = `${orgId}:${dataset}:${rowKey}`
  await db.query(
    `INSERT INTO company_dataset_rows (id, org_id, dataset, row_key, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (org_id, dataset, row_key) DO UPDATE SET payload = EXCLUDED.payload`,
    [id, orgId, dataset, rowKey, JSON.stringify(payload)],
  )
}

async function upsertPinkPerson(db: Db, orgId: string, row: Record<string, string>) {
  const shortName = row['短名']
  const id = creatorIdFor(shortName)
  const key = `ck_imok_${SHORT_SLUG[shortName] || shortName}`
  const verifiedWan = Number(row['当天核实万'])
  const listWan = Number(row['名单粉丝万'])
  const gapWan = Number(row['距50万'])
  const followers = Number.isFinite(verifiedWan) ? Math.round(verifiedWan * 10000) : null
  const band = Number.isFinite(gapWan) ? followersBand(gapWan) : '不够'
  const verticals = (row['内容'] || '').split(/[、,，]/).map((v) => v.trim()).filter(Boolean)
  await db.query(
    `INSERT INTO creators (
        id, creator_key, display_name, status, needs_review, followers, followers_unknown,
        regions, verticals, rating, note, org_id, ingest_snapshot
      ) VALUES ($1,$2,$3,'released',false,$4,$5,$6,$7,null,$8,$9,$10::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        creator_key = EXCLUDED.creator_key,
        display_name = EXCLUDED.display_name,
        status = 'released',
        followers = EXCLUDED.followers,
        followers_unknown = EXCLUDED.followers_unknown,
        regions = EXCLUDED.regions,
        verticals = EXCLUDED.verticals,
        note = EXCLUDED.note,
        org_id = EXCLUDED.org_id,
        ingest_snapshot = EXCLUDED.ingest_snapshot,
        updated_at = now()`,
    [
      id,
      key,
      row['姓名'],
      followers,
      followers == null,
      [row['地区']].filter(Boolean),
      verticals,
      row['结论'] || null,
      orgId,
      JSON.stringify(row),
    ],
  )
  await db.query('DELETE FROM creator_categories WHERE creator_id = $1', [id])
  await db.query(
    `INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,'collaborated')
     ON CONFLICT DO NOTHING`,
    [id],
  )
  await db.query(
    `INSERT INTO collaborations (id, creator_id, brand, note)
     VALUES ($1,$2,'IMOK',$3)
     ON CONFLICT (id) DO UPDATE SET brand = EXCLUDED.brand, note = EXCLUDED.note`,
    [`col_${id}_imok`, id, row['对接'] || 'pink'],
  )
  await db.query(
    `INSERT INTO company_creator_attrs (
        org_id, creator_id, advice, followers_band, outreach, korea_relation, conclusion, risk, payload
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT (org_id, creator_id) DO UPDATE SET
        advice = EXCLUDED.advice,
        followers_band = EXCLUDED.followers_band,
        outreach = EXCLUDED.outreach,
        korea_relation = EXCLUDED.korea_relation,
        conclusion = EXCLUDED.conclusion,
        risk = EXCLUDED.risk,
        payload = EXCLUDED.payload`,
    [
      orgId,
      id,
      row['建议'],
      band,
      row['对接'],
      row['韩国强度'] || row['韩国关系'],
      row['结论'],
      row['风险'],
      JSON.stringify({
        listWan,
        verifiedWan,
        gapWan,
        koreaRelationText: row['韩国关系'],
        koreaStrength: row['韩国强度'],
      }),
    ],
  )
  await db.query(
    `INSERT INTO company_collaborators (org_id, creator_id, source, outreach, conclusion)
     VALUES ($1,$2,'pink',$3,$4)
     ON CONFLICT (org_id, creator_id) DO UPDATE SET
       source = EXCLUDED.source,
       outreach = EXCLUDED.outreach,
       conclusion = EXCLUDED.conclusion`,
    [orgId, id, row['对接'], row['结论']],
  )
}

export function buildImokPinkPack(summary: Record<string, string>[]) {
  return {
    slug: 'imok-pink',
    title: 'IMOK Pink',
    dimensions: [
      { key: 'advice', label: '建议', options: uniq(summary.map((r) => r['建议'])) },
      { key: 'followersBand', label: '粉量', options: ['过线', '接近', '不够'], thresholdWan: 50 },
      { key: 'outreach', label: '对接', options: uniq(summary.map((r) => r['对接'])) },
      { key: 'koreaRelation', label: '韩国关系', options: uniq(summary.map((r) => r['韩国强度'] || r['韩国关系'])) },
      { key: 'conclusion', label: '结论', options: uniq(summary.map((r) => r['结论'])) },
      { key: 'risk', label: '风险', options: uniq(summary.map((r) => r['风险'])) },
    ],
  }
}

export async function importImokPink(db: Db, orgId = IMOK_ID): Promise<ImportCounts> {
  const summary = parseCsv(fixtureText(FILES.summary))
  const detail = parseCsv(fixtureText(FILES.detail))
  const chart = parseCsv(fixtureText(FILES.chart))

  for (const row of summary) {
    await upsertDatasetRow(db, orgId, 'summary', row['短名'] || row['姓名'], row)
    await upsertPinkPerson(db, orgId, row)
  }
  for (const row of detail) {
    const key = [row['排序'], row['短名'], row['栏目'], row['字段']].join('|')
    await upsertDatasetRow(db, orgId, 'detail', key, row)
  }
  for (const row of chart) {
    const key = [row['图号'], row['对象'], row['分类或日期'], row['系列']].join('|')
    await upsertDatasetRow(db, orgId, 'chart', key, row)
  }

  const pack = buildImokPinkPack(summary)
  await db.query(
    `INSERT INTO company_rule_packs (id, org_id, slug, title, filters)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (org_id, slug) DO UPDATE SET title = EXCLUDED.title, filters = EXCLUDED.filters`,
    ['pack_imok_pink', orgId, pack.slug, pack.title, JSON.stringify(pack)],
  )

  return { summary: summary.length, detail: detail.length, chart: chart.length }
}
