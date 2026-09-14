import {
  DEFAULT_QUERY_COLUMNS,
  defaultSavedQuery,
  SEED_USERS,
  type SavedQuery,
  type SourceId,
} from '@kcs/contract'
import type { Db } from './db'
import { pugongyingAdapter, qianguaAdapter, xinhongAdapter } from './adapters'
import { fixturePage } from './adapters/common'

const CATEGORIES = [
  ['collaborated', '合作过的', 'Collaborated', '협업함', 'coop_history', true],
  ['never_collaborated', '没合作过的', 'Never collaborated', '협업 없음', 'coop_history', true],
  ['intending', '意向中', 'Intending', '의향', null, true],
  ['blacklist', '黑名单', 'Blacklist', '블랙리스트', null, false],
  ['stale', '待更新', 'Stale', '업데이트 필요', null, true],
] as const

export type SeedCounts = {
  users: number
  talents: number
  unpublished: number
  projects: number
  assignments: number
  ingestJobs: number
}

const ADAPTERS = [pugongyingAdapter, qianguaAdapter, xinhongAdapter]

const PROJECTS = [
  ['seed_proj_beauty', '韩妆性价比', ['seed_pugongying_pgy_001', 'seed_qiangua_qg_001', 'seed_xinhong_xh_006']],
  ['seed_proj_food', '首尔与济州探店', ['seed_pugongying_pgy_004', 'seed_qiangua_qg_002', 'seed_xinhong_xh_002']],
  ['seed_proj_lifestyle', '韩系生活方式', ['seed_pugongying_pgy_003', 'seed_qiangua_qg_004', 'seed_xinhong_xh_003']],
  ['seed_proj_newcomers', '潜力新人', ['seed_pugongying_pgy_007', 'seed_qiangua_qg_007', 'seed_xinhong_xh_007']],
] as const

const JOB_STATUSES = ['failed', 'ok', 'running', 'queued', 'ok', 'failed'] as const

function seedQuery(id: string, spec: SavedQuery): SavedQuery {
  return { ...spec, id, version: 1 }
}

const SAVED_QUERIES: SavedQuery[] = [
  seedQuery(
    'seed_query_kbeauty_value',
    defaultSavedQuery({
      name: '韩妆性价比',
      health: ['excellent'],
      filters: [{ key: 'cpe', op: 'lte', value: 3 }],
      sort: { key: 'cpe', dir: 'asc' },
      columns: [...DEFAULT_QUERY_COLUMNS],
    }),
  ),
  seedQuery(
    'seed_query_rising_junior',
    defaultSavedQuery({
      name: '潜力新人',
      health: [],
      tiers: ['junior'],
      filters: [{ key: 'readToFollowerRatio', op: 'percentileGte', value: 75 }],
      sort: { key: 'readToFollowerRatio', dir: 'desc' },
      columns: [...DEFAULT_QUERY_COLUMNS],
    }),
  ),
]

async function seedUsers(db: Db, orgId: string) {
  for (const user of SEED_USERS) {
    const id = `user_${user.role}`
    await db.query(
      `INSERT INTO users (id, org_id, email, role, display_name)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name`,
      [id, orgId, user.email, user.role, user.displayName],
    )
  }
  for (const extra of [
    ['user_platform_admin_e2e', 'platform.admin@kcs.local', 'platform_admin', 'Platform Admin'],
    ['user_selector_viewer_e2e', 'selector.viewer@kcs.local', 'selector_viewer', 'Selector Viewer'],
  ]) {
    await db.query(
      `INSERT INTO users (id, org_id, email, role, display_name)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`,
      [extra[0], orgId, extra[1], extra[2], extra[3]],
    )
  }
}

async function seedCreators(db: Db) {
  const canonicalIds = new Map<string, string>()
  let index = 0
  for (const adapter of ADAPTERS) {
    const page = fixturePage(
      adapter.id,
      new URL(`./adapters/fixtures/${adapter.id}.json`, import.meta.url),
      { source: adapter.id, window: 30 },
    )
    for (const raw of page.records) {
      const result = adapter.normalize(raw)
      if (!result.ok) continue
      index += 1
      const creator = result.creator
      const sourceId = `seed_${adapter.id}_${creator.externalId}`
      const matched = creator.xhsId
        ? await db.query('SELECT id FROM creators WHERE xhs_id = $1 ORDER BY updated_at DESC LIMIT 1', [
            creator.xhsId,
          ])
        : { rows: [] as Array<{ id: string }> }
      const id = matched.rows[0]?.id ?? sourceId
      canonicalIds.set(sourceId, id)
      const isBad = creator.metrics.health === 'abnormal'
      const released = !isBad && index % 6 !== 0
      const status = released ? 'released' : 'draft'
      await db.query(
        `INSERT INTO creators (
           id, creator_key, display_name, status, needs_review, followers, followers_unknown,
           regions, verticals, xhs_id, metrics, metrics_window, source, external_id,
           metrics_fetched_at, metrics_locked, note
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,30,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO UPDATE SET
           creator_key = EXCLUDED.creator_key, display_name = EXCLUDED.display_name,
           status = EXCLUDED.status, needs_review = EXCLUDED.needs_review,
           followers = EXCLUDED.followers, followers_unknown = EXCLUDED.followers_unknown,
           regions = EXCLUDED.regions, verticals = EXCLUDED.verticals, xhs_id = EXCLUDED.xhs_id,
           metrics = EXCLUDED.metrics, metrics_window = EXCLUDED.metrics_window,
           source = EXCLUDED.source, external_id = EXCLUDED.external_id,
           metrics_fetched_at = EXCLUDED.metrics_fetched_at,
           metrics_locked = EXCLUDED.metrics_locked, note = EXCLUDED.note, updated_at = now()`,
        [
          id,
          creator.creatorKey,
          creator.displayName,
          status,
          !released,
          creator.metrics.followers,
          creator.metrics.followers == null,
          creator.regions,
          creator.verticals,
          creator.xhsId,
          JSON.stringify(creator.metrics),
          adapter.id,
          creator.externalId,
          raw.fetchedAt,
          released ? JSON.stringify(creator.metrics) : null,
          `${adapter.id} fixture`,
        ],
      )
      await db.query(
        `INSERT INTO creator_sources
          (creator_id, source, external_id, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$4)
         ON CONFLICT (source, external_id) DO UPDATE SET
           creator_id = EXCLUDED.creator_id, last_seen_at = EXCLUDED.last_seen_at`,
        [id, adapter.id, creator.externalId, raw.fetchedAt],
      )
      await db.query('DELETE FROM creator_categories WHERE creator_id = $1', [id])
      const latestAt = new Date(raw.fetchedAt)
      for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo -= 1) {
        const fetchedAt = new Date(latestAt)
        fetchedAt.setUTCDate(fetchedAt.getUTCDate() - weeksAgo * 7)
        const factor = 1 - weeksAgo * 0.035
        const metrics = weeksAgo === 0
          ? creator.metrics
          : {
              ...creator.metrics,
              followers: creator.metrics.followers == null
                ? null
                : Math.round(creator.metrics.followers * factor),
              readMedian: creator.metrics.readMedian == null
                ? null
                : Math.round(creator.metrics.readMedian * factor * 0.98),
              cpe: creator.metrics.cpe == null
                ? null
                : Number((creator.metrics.cpe * (1 + weeksAgo * 0.04)).toFixed(2)),
            }
        await db.query(
          `INSERT INTO creator_metrics_history
            (id, creator_id, source, "window", fetched_at, job_id, metrics)
           VALUES ($1,$2,$3,$4,$5,NULL,$6)
           ON CONFLICT (id) DO UPDATE SET
             source = EXCLUDED.source,
             "window" = EXCLUDED."window",
             fetched_at = EXCLUDED.fetched_at,
             metrics = EXCLUDED.metrics`,
          [
            `${id}_history_${weeksAgo}`,
            id,
            adapter.id,
            creator.metrics.window,
            fetchedAt,
            JSON.stringify(metrics),
          ],
        )
      }
      await db.query(
        `INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,$2)`,
        [id, isBad ? 'blacklist' : creator.metrics.coopBrands.length ? 'collaborated' : 'never_collaborated'],
      )
      await db.query('DELETE FROM collaborations WHERE creator_id = $1', [id])
      for (const [brandIndex, brand] of creator.metrics.coopBrands.entries()) {
        await db.query(
          `INSERT INTO collaborations (id, creator_id, brand, happened_at)
           VALUES ($1,$2,$3,CURRENT_DATE) ON CONFLICT (id) DO UPDATE SET brand = EXCLUDED.brand`,
          [`col_${id}_${brandIndex}`, id, brand],
        )
      }
      await db.query('DELETE FROM prices WHERE creator_id = $1', [id])
      if (creator.metrics.priceImage != null) {
        await db.query(
          `INSERT INTO prices (id, creator_id, amount_min, amount_max, currency, unit)
           VALUES ($1,$2,$3,$4,'CNY','per_post')
           ON CONFLICT (id) DO UPDATE SET amount_min = EXCLUDED.amount_min, amount_max = EXCLUDED.amount_max`,
          [`price_${id}`, id, creator.metrics.priceImage, creator.metrics.priceVideo],
        )
      }
    }
  }
  return canonicalIds
}

async function seedProjects(db: Db, orgId: string, canonicalIds: Map<string, string>) {
  for (const [id, name, members] of PROJECTS) {
    await db.query(
      `INSERT INTO projects (id, org_id, name, note, status) VALUES ($1,$2,$3,$4,'open')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, note = EXCLUDED.note, status = 'open'`,
      [id, orgId, name, 'fixture 指标项目'],
    )
    await db.query('DELETE FROM assignments WHERE project_id = $1', [id])
    for (const creatorId of new Set(members.map((member) => canonicalIds.get(member) ?? member))) {
      await db.query(
        `INSERT INTO assignments (id, project_id, creator_id, status, assigned_by, note)
         VALUES ($1,$2,$3,'assigned','user_selector','种子项目')
         ON CONFLICT (project_id, creator_id) DO UPDATE SET status = 'assigned', note = EXCLUDED.note`,
        [`asgn_${id}_${creatorId}`, id, creatorId],
      )
    }
  }
}

export async function seed(db: Db, opts: { reset?: boolean } = {}): Promise<SeedCounts> {
  if (opts.reset) {
    await db.query(`
      TRUNCATE TABLE
        audit_logs, reviews, shortlist_items, assignments, projects, saved_queries,
        creator_raw, creator_metrics_history, creator_sources, prices, collaborations, creator_categories, creators, assets,
        ingest_jobs, ingest_source_usage, ingest_sources, users, orgs, categories
      RESTART IDENTITY CASCADE
    `)
  }
  const orgId = 'org_platform'
  await db.query(
    `INSERT INTO orgs (id, name, budget_note) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [orgId, '全球达人情报', '试水单笔 ≤80000 CNY'],
  )
  await seedUsers(db, orgId)
  for (const [slug, zh, en, ko, group, visible] of CATEGORIES) {
    await db.query(
      `INSERT INTO categories (slug, name_zh, name_en, name_ko, builtin, enabled, group_name, frontend_visible)
       VALUES ($1,$2,$3,$4,true,true,$5,$6) ON CONFLICT (slug) DO NOTHING`,
      [slug, zh, en, ko, group, visible],
    )
  }
  for (const [id, name, adapterType] of [
    ['file-drop', '文件投递', 'file_drop'],
    ['pugongying', '蒲公英 OpenAPI', 'pugongying'],
    ['qiangua', '千瓜', 'qiangua'],
    ['xinhong', '新红', 'xinhong'],
  ]) {
    await db.query(
      `INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, owner)
       VALUES ($1,$2,$3,true,60,1000,'ops')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, adapter_type = EXCLUDED.adapter_type`,
      [id, name, adapterType],
    )
  }
  for (const [index, status] of JOB_STATUSES.entries()) {
    await db.query(
      `INSERT INTO ingest_jobs (
         id, source_id, schedule, status, attempt, written_count, skipped_dupes, failed_count,
         error_code, error_summary, opened_by, source_mode, created_at, updated_at
       ) VALUES ($1,'file-drop','once',$2,$3,$4,$5,$6,$7,$8,'user_devops','fixture',
         now() - ($9 || ' hours')::interval, now())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, attempt = EXCLUDED.attempt,
         written_count = EXCLUDED.written_count, failed_count = EXCLUDED.failed_count`,
      [
        `job_seed_${index + 1}`,
        status,
        index % 3,
        status === 'ok' ? 8 + index : 0,
        status === 'ok' ? 1 : 0,
        status === 'failed' ? 1 : 0,
        status === 'failed' ? 'SOURCE_UNAVAILABLE' : null,
        status === 'failed' ? 'fixture job failure' : null,
        index + 1,
      ],
    )
  }
  const canonicalIds = await seedCreators(db)
  await seedProjects(db, orgId, canonicalIds)
  for (const spec of SAVED_QUERIES) {
    await db.query(
      `INSERT INTO saved_queries (id, org_id, name, version, spec, created_by)
       VALUES ($1,$2,$3,1,$4,'user_selector')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, version = 1, spec = EXCLUDED.spec, updated_at = now()`,
      [spec.id, orgId, spec.name, JSON.stringify(spec)],
    )
  }

  const [users, talents, unpublished, projects, assignments, ingestJobs] = await Promise.all([
    db.query('SELECT count(*)::int AS n FROM users WHERE email = ANY($1)', [SEED_USERS.map((u) => u.email)]),
    db.query(`SELECT count(*)::int AS n FROM creators WHERE id LIKE 'seed_%'`),
    db.query(`SELECT count(*)::int AS n FROM creators WHERE id LIKE 'seed_%' AND status <> 'released'`),
    db.query(`SELECT count(*)::int AS n FROM projects WHERE id LIKE 'seed_proj_%'`),
    db.query(`SELECT count(*)::int AS n FROM assignments WHERE project_id LIKE 'seed_proj_%'`),
    db.query(`SELECT count(*)::int AS n FROM ingest_jobs WHERE id LIKE 'job_seed_%'`),
  ])
  return {
    users: users.rows[0].n,
    talents: talents.rows[0].n,
    unpublished: unpublished.rows[0].n,
    projects: projects.rows[0].n,
    assignments: assignments.rows[0].n,
    ingestJobs: ingestJobs.rows[0].n,
  }
}
