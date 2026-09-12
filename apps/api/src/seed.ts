import { randomUUID } from 'node:crypto'
import { SEED_PASSWORD, SEED_USERS } from '@kcs/contract'
import type { Db } from './db'
import { hashPassword } from './password'

const CATEGORIES = [
  {
    slug: 'collaborated',
    zh: '合作过的',
    en: 'Collaborated',
    ko: '협업함',
    group: 'coop_history',
  },
  {
    slug: 'never_collaborated',
    zh: '没合作过的',
    en: 'Never collaborated',
    ko: '협업 없음',
    group: 'coop_history',
  },
  { slug: 'intending', zh: '意向中', en: 'Intending', ko: '의향', group: null },
  { slug: 'blacklist', zh: '黑名单', en: 'Blacklist', ko: '블랙리스트', group: null },
  { slug: 'stale', zh: '待更新', en: 'Stale', ko: '업데이트 필요', group: null },
]

export async function seed(db: Db, opts: { reset?: boolean } = {}): Promise<void> {
  if (opts.reset) {
    await db.query(`
      TRUNCATE TABLE
        audit_logs, reviews, shortlist_items, assignments, projects,
        prices, collaborations, creator_categories, creators, assets,
        ingest_jobs, ingest_sources, sessions, "user", users, orgs, categories
      RESTART IDENTITY CASCADE
    `)
  }

  const orgId = 'org_platform'
  await db.query('INSERT INTO orgs (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    orgId,
    '全球达人情报',
  ])

  for (const user of SEED_USERS) {
    await db.query(
      `INSERT INTO users (id, org_id, email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name`,
      [
        `user_${user.role}`,
        orgId,
        user.email,
        hashPassword(SEED_PASSWORD),
        user.role,
        user.displayName,
      ],
    )
    await db.query(
      `INSERT INTO "user" (id, email, name, role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, updated_at = now()`,
      [`user_${user.role}`, user.email, user.displayName, user.role],
    )
  }

  const extras = [
    { id: 'user_platform_admin_e2e', email: 'platform.admin@kcs.local', role: 'platform_admin', name: 'Platform Admin' },
    { id: 'user_selector_viewer_e2e', email: 'selector.viewer@kcs.local', role: 'selector_viewer', name: 'Selector Viewer' },
  ]
  for (const extra of extras) {
    await db.query(
      `INSERT INTO users (id, org_id, email, password_hash, role, display_name)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`,
      [extra.id, orgId, extra.email, hashPassword('KcsE2e!2026'), extra.role, extra.name],
    )
    await db.query(
      `INSERT INTO "user" (id, email, name, role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
      [extra.id, extra.email, extra.name, extra.role],
    )
  }

  for (const cat of CATEGORIES) {
    await db.query(
      `INSERT INTO categories (slug, name_zh, name_en, name_ko, builtin, enabled, group_name, frontend_visible)
       VALUES ($1,$2,$3,$4,true,true,$5,$6)
       ON CONFLICT (slug) DO NOTHING`,
      [cat.slug, cat.zh, cat.en, cat.ko, cat.group, cat.slug !== 'blacklist'],
    )
  }

  await db.query(
    `INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, owner)
     VALUES ($1,$2,$3,true,60,1000,'ops')
     ON CONFLICT (id) DO NOTHING`,
    ['file-drop', '文件投递', 'file_drop'],
  )

  await db.query(
    `INSERT INTO ingest_jobs
      (id, source_id, schedule, status, attempt, written_count, skipped_dupes, failed_count, error_code, error_summary, opened_by)
     VALUES ($1,$2,'once','failed',1,0,0,1,'SOURCE_UNAVAILABLE','adapter unavailable (no secret leaked)','user_devops')
     ON CONFLICT (id) DO NOTHING`,
    ['job_seed_failed', 'file-drop'],
  )

  await db.query(
    `INSERT INTO creators
      (id, creator_key, display_name, status, needs_review, followers, followers_unknown, regions, verticals, rating)
     VALUES ($1,$2,$3,'released',false,128000,false,$4,$5,4.6)
     ON CONFLICT (creator_key) DO UPDATE SET
       status = 'released',
       followers = EXCLUDED.followers,
       display_name = EXCLUDED.display_name`,
    ['seed_creator_pool', 'ck_seed_pool', '种子达人', ['서울'], ['beauty']],
  )
  await db.query(
    `INSERT INTO creator_categories (creator_id, category_slug)
     VALUES ('seed_creator_pool', 'never_collaborated')
     ON CONFLICT DO NOTHING`,
  )
  await db.query(`DELETE FROM prices WHERE creator_id = 'seed_creator_pool'`)
  await db.query(
    `INSERT INTO prices (id, creator_id, amount_min, amount_max, currency, unit)
     VALUES ($1,'seed_creator_pool',8000,12000,'CNY','per_post')`,
    [randomUUID()],
  )
}
