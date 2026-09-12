import { SEED_PASSWORD, SEED_USERS } from '@kcs/contract'
import type { Db } from './db'
import { HANSOUL_ID, IMOK_ID, PLATFORM_ID, importImokPink, type ImportCounts } from './imok-pink'
import { hashPassword } from './password'
import { attachTalentMedia } from './seed-media'
import type { ObjectStore } from './store'

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

export type SeedCounts = {
  users: number
  talents: number
  unpublished: number
  projects: number
  assignments: number
  ingestJobs: number
  imported: ImportCounts
}

type TalentSeed = {
  id: string
  key: string
  name: string
  status: 'released' | 'draft' | 'ready'
  needsReview?: boolean
  followers: number | null
  followersUnknown?: boolean
  regions: string[]
  verticals: string[]
  rating: number | null
  note?: string
  label: 'S' | 'A' | 'B' | 'C'
  xhsId?: string
  er?: number
  lockedFinal?: number
  categories: string[]
  brands?: { brand: string; at: string; note?: string }[]
  price?: { min: number; max?: number; currency: 'CNY' | 'USD' | 'KRW' }
}

type JobSeed = {
  id: string
  status: 'ok' | 'failed' | 'running' | 'queued'
  attempt: number
  written: number
  skipped: number
  failed: number
  errorCode?: string
  errorSummary?: string
  fileName?: string
  batchName?: string
  sourceRows?: number
  hoursAgo: number
}

const TALENTS: TalentSeed[] = [
  {
    id: 'seed_creator_pool',
    key: 'ck_seed_pool',
    name: '种子达人',
    status: 'released',
    followers: 128000,
    regions: ['서울'],
    verticals: ['beauty', '护肤'],
    rating: 4.6,
    label: 'A',
    xhsId: 'seedpool128',
    lockedFinal: 78.4,
    categories: ['never_collaborated'],
    price: { min: 8000, max: 12000, currency: 'CNY' },
  },
  {
    id: 'seed_t01',
    key: 'ck_seed_park_seoul',
    name: '서울살림노트',
    status: 'released',
    followers: 428000,
    regions: ['서울'],
    verticals: ['home', '生活方式', '韩系家居'],
    rating: 4.9,
    note: '首尔家居与生活笔记，适合品牌试水。',
    label: 'S',
    xhsId: 'parkseoulnote',
    er: 0.048,
    lockedFinal: 91.4,
    categories: ['collaborated'],
    brands: [
      { brand: '雪花秀', at: '2025-11-02', note: '家居香氛套组' },
      { brand: '홀리추얼', at: '2026-03-18', note: '春季家居联名' },
    ],
    price: { min: 420000, max: 560000, currency: 'KRW' },
  },
  {
    id: 'seed_t02',
    key: 'ck_seed_kim_beauty',
    name: '김눈빛',
    status: 'released',
    followers: 312000,
    regions: ['부산'],
    verticals: ['beauty', '美妆', '护肤'],
    rating: 4.7,
    note: '韩妆空瓶与 Olive Young 功课。',
    label: 'A',
    xhsId: 'kimnunbit',
    er: 0.041,
    lockedFinal: 86.2,
    categories: ['collaborated'],
    brands: [
      { brand: '설화수', at: '2026-01-20', note: '精华液图文' },
      { brand: 'emis', at: '2026-06-08' },
    ],
    price: { min: 15000, max: 22000, currency: 'CNY' },
  },
  {
    id: 'seed_t03',
    key: 'ck_seed_lee_food',
    name: '리식당일기',
    status: 'released',
    followers: 198000,
    regions: ['서울'],
    verticals: ['food', '探店', '韩食'],
    rating: 4.5,
    note: '弘大小酒馆与韩食节奏清楚。',
    label: 'A',
    xhsId: 'leesikdang',
    er: 0.036,
    lockedFinal: 79.8,
    categories: ['never_collaborated'],
    price: { min: 3500, max: 5200, currency: 'CNY' },
  },
  {
    id: 'seed_t04',
    key: 'ck_seed_choi_travel',
    name: '최주말열차',
    status: 'released',
    followers: 156000,
    regions: ['강원'],
    verticals: ['travel', '旅行', '韩系穿搭'],
    rating: 4.2,
    note: '江原道周末旅行，目的地合作更合适。',
    label: 'B',
    xhsId: 'choiwkend',
    lockedFinal: 71.5,
    categories: ['never_collaborated', 'intending'],
    price: { min: 2800, max: 3600, currency: 'USD' },
  },
  {
    id: 'seed_t05',
    key: 'ck_seed_jung_fit',
    name: '정러닝클럽',
    status: 'released',
    followers: 89000,
    regions: ['인천'],
    verticals: ['fitness', '跑步', '运动内衣'],
    rating: 4.3,
    note: '汉江夜跑团，垂直运动盘。',
    label: 'B',
    xhsId: 'jungrunclub',
    er: 0.052,
    lockedFinal: 64.1,
    categories: ['collaborated'],
    brands: [{ brand: 'rockfish', at: '2026-04-12', note: '跑鞋测评' }],
    price: { min: 2500, max: 3200, currency: 'USD' },
  },
  {
    id: 'seed_t06',
    key: 'ck_seed_han_promo',
    name: '한딜폭탄',
    status: 'draft',
    needsReview: true,
    followers: 540000,
    regions: ['경기'],
    verticals: ['promo', '折扣', '直播'],
    rating: 3.4,
    note: '折扣号，品牌调性冲突，先不发布。',
    label: 'C',
    xhsId: 'handealbomb',
    lockedFinal: 52.0,
    categories: ['never_collaborated', 'blacklist'],
    price: { min: 18000, max: 26000, currency: 'CNY' },
  },
  {
    id: 'seed_t07',
    key: 'ck_seed_mina_jeju',
    name: '济州空瓶Mina',
    status: 'released',
    followers: 186000,
    regions: ['제주'],
    verticals: ['beauty', '空瓶', '护肤'],
    rating: 4.8,
    note: '济州韩妆空瓶，适合美妆试水。',
    label: 'A',
    xhsId: '582910384',
    er: 0.044,
    lockedFinal: 82.6,
    categories: ['collaborated'],
    brands: [{ brand: '홀리추얼', at: '2026-02-14', note: '防晒气垫' }],
    price: { min: 18000, max: 24000, currency: 'CNY' },
  },
  {
    id: 'seed_t08',
    key: 'ck_seed_yuna_sungsu',
    name: '圣水穿搭Yuna',
    status: 'released',
    followers: 72000,
    regions: ['서울'],
    verticals: ['fashion', '穿搭', '时尚'],
    rating: 4.4,
    note: '圣水洞街拍，韩系穿搭密度高。',
    label: 'B',
    xhsId: 'yunasungsu',
    lockedFinal: 73.2,
    categories: ['never_collaborated'],
    price: { min: 280000, max: 350000, currency: 'KRW' },
  },
  {
    id: 'seed_t09',
    key: 'ck_seed_leo_mydong',
    name: '明洞开箱Leo',
    status: 'released',
    followers: 210000,
    regions: ['서울'],
    verticals: ['unbox', '开箱', 'vlog'],
    rating: 4.6,
    note: '明洞开箱周更，适合新品首发。',
    label: 'A',
    xhsId: 'leomydong',
    er: 0.033,
    lockedFinal: 80.1,
    categories: ['collaborated'],
    brands: [{ brand: 'emis', at: '2026-05-03', note: '帽款开箱' }],
    price: { min: 4000, max: 5500, currency: 'USD' },
  },
  {
    id: 'seed_t10',
    key: 'ck_seed_sora_hongdae',
    name: '弘大探店Sora',
    status: 'released',
    followers: 45000,
    regions: ['서울'],
    verticals: ['food', '探店'],
    rating: 4.1,
    note: '弘大夜宵图文，客单价友好。',
    label: 'B',
    xhsId: 'sorahongdae',
    lockedFinal: 69.0,
    categories: ['never_collaborated'],
    price: { min: 4200, max: 6000, currency: 'CNY' },
  },
  {
    id: 'seed_t11',
    key: 'ck_seed_kai_hangang',
    name: '汉江夜跑Kai',
    status: 'ready',
    followers: 28000,
    regions: ['서울'],
    verticals: ['fitness', '跑步'],
    rating: 3.9,
    note: '校对完成，待发布。',
    label: 'C',
    xhsId: 'kaihangang',
    lockedFinal: 61.2,
    categories: ['never_collaborated'],
    price: { min: 3000, max: 4000, currency: 'CNY' },
  },
  {
    id: 'seed_t12',
    key: 'ck_seed_home_weekend',
    name: '家居Weekend',
    status: 'released',
    followers: 265000,
    regions: ['서울'],
    verticals: ['home', '生活方式', '韩系家居'],
    rating: 4.8,
    note: '周末家居摆拍，适合家居香氛。',
    label: 'S',
    xhsId: 'homeweekend',
    er: 0.039,
    lockedFinal: 88.7,
    categories: ['collaborated'],
    brands: [
      { brand: '雪花秀', at: '2025-09-11' },
      { brand: '홀리추얼', at: '2026-01-08' },
    ],
    price: { min: 550000, max: 620000, currency: 'KRW' },
  },
  {
    id: 'seed_t13',
    key: 'ck_seed_hae_skin',
    name: '护肤日记Hae',
    status: 'released',
    followers: 98000,
    regions: ['부산'],
    verticals: ['beauty', '护肤'],
    rating: 4.5,
    note: '敏感肌功课，报价已核。',
    label: 'A',
    xhsId: 'haeskin',
    lockedFinal: 76.4,
    categories: ['never_collaborated', 'intending'],
    price: { min: 12000, max: 16000, currency: 'CNY' },
  },
  {
    id: 'seed_t14',
    key: 'ck_seed_busan_wind',
    name: '釜山海风',
    status: 'draft',
    needsReview: true,
    followers: null,
    followersUnknown: true,
    regions: ['부산'],
    verticals: ['travel'],
    rating: null,
    note: '粉丝数待核。',
    label: 'C',
    xhsId: 'busanwind',
    categories: ['never_collaborated', 'stale'],
  },
  {
    id: 'seed_t15',
    key: 'ck_seed_incheon_vlog',
    name: '仁川空港Vlog',
    status: 'released',
    followers: 134000,
    regions: ['인천'],
    verticals: ['travel', 'vlog'],
    rating: 4.0,
    note: '机场探店与出行装备。',
    label: 'B',
    xhsId: 'icnvlog',
    lockedFinal: 70.8,
    categories: ['collaborated'],
    brands: [{ brand: 'rockfish', at: '2025-12-22', note: '出行鞋履' }],
    price: { min: 3000, max: 4000, currency: 'USD' },
  },
  {
    id: 'seed_t16',
    key: 'ck_seed_gyeonggi_mom',
    name: '京畿妈妈团',
    status: 'released',
    followers: 67000,
    regions: ['경기'],
    verticals: ['lifestyle', '生活方式'],
    rating: 4.2,
    note: '带娃生活记录，适合家庭向货盘。',
    label: 'B',
    xhsId: 'ggmomclub',
    lockedFinal: 68.5,
    categories: ['never_collaborated'],
    price: { min: 5500, max: 7500, currency: 'CNY' },
  },
  {
    id: 'seed_t17',
    key: 'ck_seed_gangnam_suit',
    name: '江南西装',
    status: 'released',
    followers: 41000,
    regions: ['서울'],
    verticals: ['fashion', '穿搭'],
    rating: 3.8,
    note: '职场西装测评，粉丝偏中腰。',
    label: 'C',
    xhsId: 'gangnamsuit',
    lockedFinal: 58.3,
    categories: ['collaborated'],
    brands: [{ brand: 'emis', at: '2026-07-01' }],
    price: { min: 190000, max: 240000, currency: 'KRW' },
  },
  {
    id: 'seed_t18',
    key: 'ck_seed_new_qc',
    name: '待校对新号',
    status: 'draft',
    needsReview: true,
    followers: 8000,
    regions: ['서울'],
    verticals: ['beauty'],
    rating: 3.2,
    note: '文件投递待校对。',
    label: 'C',
    xhsId: 'newqc08',
    categories: ['never_collaborated'],
    price: { min: 2500, max: 3500, currency: 'CNY' },
  },
  {
    id: 'seed_t19',
    key: 'ck_seed_blacklist_ad',
    name: '黑名单硬广',
    status: 'released',
    followers: 990000,
    regions: ['서울'],
    verticals: ['promo', '硬广'],
    rating: 2.9,
    note: '硬广痕迹重，已拉黑。',
    label: 'C',
    xhsId: 'adbomb99',
    lockedFinal: 41.0,
    categories: ['collaborated', 'blacklist'],
    brands: [{ brand: 'rockfish', at: '2024-08-01', note: '历史硬广' }],
    price: { min: 25000, max: 40000, currency: 'CNY' },
  },
  {
    id: 'seed_t20',
    key: 'ck_seed_intend_beauty',
    name: '意向中的美妆',
    status: 'ready',
    followers: 52000,
    regions: ['서울'],
    verticals: ['beauty', '美妆'],
    rating: 4.0,
    note: '意向沟通中，尚未发布。',
    label: 'B',
    xhsId: 'intentbeauty',
    lockedFinal: 66.4,
    categories: ['never_collaborated', 'intending'],
    price: { min: 7000, max: 9000, currency: 'CNY' },
  },
  {
    id: 'seed_t21',
    key: 'ck_seed_gangwon_ski',
    name: '江原滑雪',
    status: 'released',
    followers: 88000,
    regions: ['강원'],
    verticals: ['travel', '旅行'],
    rating: 4.3,
    note: '滑雪季内容，适合户外装备。',
    label: 'B',
    xhsId: 'gwski',
    lockedFinal: 72.0,
    categories: ['never_collaborated'],
    price: { min: 2600, max: 3100, currency: 'USD' },
  },
  {
    id: 'seed_t22',
    key: 'ck_seed_cheongdam_skin',
    name: '清潭洞护肤',
    status: 'released',
    followers: 375000,
    regions: ['서울'],
    verticals: ['beauty', '护肤', '时尚'],
    rating: 4.9,
    note: '清潭洞护肤功课，S 档试水首选。',
    label: 'S',
    xhsId: 'cheongdamskin',
    er: 0.051,
    lockedFinal: 90.2,
    categories: ['collaborated'],
    brands: [
      { brand: '설화수', at: '2025-10-09' },
      { brand: '홀리추얼', at: '2026-03-01' },
    ],
    price: { min: 22000, max: 30000, currency: 'CNY' },
  },
  {
    id: 'seed_t23',
    key: 'ck_seed_stale_food',
    name: '待更新探店',
    status: 'released',
    followers: 19000,
    regions: ['서울'],
    verticals: ['food', '探店'],
    rating: 3.6,
    note: '资料过期，粉丝与报价待更新。',
    label: 'C',
    xhsId: 'stalefood',
    lockedFinal: 55.8,
    categories: ['never_collaborated', 'stale'],
    price: { min: 3200, max: 4800, currency: 'CNY' },
  },
  {
    id: 'seed_t24',
    key: 'ck_seed_olive_test',
    name: '橄榄年轻测',
    status: 'released',
    followers: 148000,
    regions: ['서울'],
    verticals: ['beauty', '美妆', '空瓶'],
    rating: 4.6,
    note: '올리브영 功课账号。',
    label: 'A',
    xhsId: 'olivetest',
    er: 0.037,
    lockedFinal: 81.3,
    categories: ['collaborated'],
    brands: [{ brand: '설화수', at: '2026-04-19', note: '年轻测' }],
    price: { min: 330000, max: 400000, currency: 'KRW' },
  },
  {
    id: 'seed_t25',
    key: 'ck_seed_draft_home',
    name: '未发布家居',
    status: 'draft',
    needsReview: true,
    followers: 33000,
    regions: ['경기'],
    verticals: ['home', '家居'],
    rating: 3.7,
    note: '草稿，尚未齐字段。',
    label: 'B',
    xhsId: 'drafthome',
    categories: ['never_collaborated'],
    price: { min: 4000, max: 6000, currency: 'CNY' },
  },
  {
    id: 'seed_t26',
    key: 'ck_seed_jeju_cafe',
    name: '济州咖啡日记',
    status: 'released',
    followers: 61000,
    regions: ['제주'],
    verticals: ['food', '探店', '咖啡'],
    rating: 4.4,
    note: '济州咖啡馆图文，适合饮品试投。',
    label: 'B',
    xhsId: 'jejucafe',
    lockedFinal: 67.9,
    categories: ['never_collaborated'],
    price: { min: 2700, max: 3400, currency: 'USD' },
  },
]

const JOBS: JobSeed[] = [
  {
    id: 'job_seed_failed',
    status: 'failed',
    attempt: 1,
    written: 0,
    skipped: 0,
    failed: 1,
    errorCode: 'SOURCE_UNAVAILABLE',
    errorSummary: 'adapter unavailable (no secret leaked)',
    hoursAgo: 26,
  },
  {
    id: 'job_seed_ok',
    status: 'ok',
    attempt: 1,
    written: 18,
    skipped: 2,
    failed: 0,
    fileName: 'seoul-beauty.xlsx',
    batchName: '首尔美妆周更',
    sourceRows: 20,
    hoursAgo: 8,
  },
  {
    id: 'job_seed_running',
    status: 'running',
    attempt: 0,
    written: 4,
    skipped: 0,
    failed: 0,
    fileName: 'hangang-fit.csv',
    batchName: '汉江运动盘',
    sourceRows: 40,
    hoursAgo: 1,
  },
  {
    id: 'job_seed_queued',
    status: 'queued',
    attempt: 0,
    written: 0,
    skipped: 0,
    failed: 0,
    fileName: 'jeju-cafes.xlsx',
    batchName: '济州咖啡',
    sourceRows: 12,
    hoursAgo: 0,
  },
  {
    id: 'job_seed_partial',
    status: 'ok',
    attempt: 2,
    written: 9,
    skipped: 3,
    failed: 2,
    errorCode: 'ROW_INVALID',
    errorSummary: '2 rows missing display name',
    fileName: 'mixed-verticals.xlsx',
    batchName: '综合垂类',
    sourceRows: 14,
    hoursAgo: 14,
  },
  {
    id: 'job_seed_retry',
    status: 'failed',
    attempt: 3,
    written: 0,
    skipped: 0,
    failed: 6,
    errorCode: 'PARSE_FAILED',
    errorSummary: 'workbook parse failed (no secret leaked)',
    fileName: 'broken.xlsx',
    batchName: '损坏表',
    sourceRows: 6,
    hoursAgo: 40,
  },
  {
    id: 'job_seed_xlsx',
    status: 'ok',
    attempt: 1,
    written: 11,
    skipped: 1,
    failed: 0,
    fileName: 'gangwon-weekend.xlsx',
    batchName: '江原周末',
    sourceRows: 12,
    hoursAgo: 3,
  },
]

const PROJECTS = [
  {
    id: 'seed_proj_jeju',
    name: '济州美妆试水',
    note: '韩妆空瓶与精华，先核报价再谈档期。',
    members: [
      { creatorId: 'seed_t01', note: '家居香氛对照' },
      { creatorId: 'seed_t02', note: '优先核설화수报价' },
      { creatorId: 'seed_t07', note: '济州空瓶主力' },
    ],
  },
  {
    id: 'seed_proj_food',
    name: '首尔探店春季档',
    note: '弘大与韩食，适合餐饮试投放。',
    members: [
      { creatorId: 'seed_t03', note: '小酒馆主笔' },
      { creatorId: 'seed_t10', note: '夜宵图文' },
      { creatorId: 'seed_creator_pool', note: '对照样本' },
    ],
  },
  {
    id: 'seed_proj_fit',
    name: '汉江运动内衣',
    note: '跑步与出行鞋履对照。',
    members: [
      { creatorId: 'seed_t05', note: '夜跑团' },
      { creatorId: 'seed_t21', note: '滑雪季备用' },
    ],
  },
  {
    id: 'seed_proj_home',
    name: '韩系家居生活方式',
    note: '家居香氛与周末摆拍。',
    members: [
      { creatorId: 'seed_t12', note: '主视觉' },
      { creatorId: 'seed_t01', note: '生活笔记复用' },
      { creatorId: 'seed_t04', note: '旅行向穿搭' },
    ],
  },
  {
    id: 'seed_proj_open',
    name: '明洞开箱周',
    note: '新品首发开箱。',
    members: [
      { creatorId: 'seed_t09', note: '开箱主力' },
      { creatorId: 'seed_t13', note: '护肤对照' },
    ],
  },
]

async function upsertTalent(db: Db, talent: TalentSeed) {
  await db.query(
    `INSERT INTO creators (
        id, creator_key, display_name, status, needs_review, followers, followers_unknown,
        regions, verticals, rating, note, label, xhs_id, er, locked_final, org_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET
        creator_key = EXCLUDED.creator_key,
        display_name = EXCLUDED.display_name,
        status = EXCLUDED.status,
        needs_review = EXCLUDED.needs_review,
        followers = EXCLUDED.followers,
        followers_unknown = EXCLUDED.followers_unknown,
        regions = EXCLUDED.regions,
        verticals = EXCLUDED.verticals,
        rating = EXCLUDED.rating,
        note = EXCLUDED.note,
        label = EXCLUDED.label,
        xhs_id = EXCLUDED.xhs_id,
        er = EXCLUDED.er,
        locked_final = EXCLUDED.locked_final,
        org_id = EXCLUDED.org_id,
        updated_at = now()`,
    [
      talent.id,
      talent.key,
      talent.name,
      talent.status,
      Boolean(talent.needsReview),
      talent.followers,
      Boolean(talent.followersUnknown),
      talent.regions,
      talent.verticals,
      talent.rating,
      talent.note ?? null,
      talent.label,
      talent.xhsId ?? null,
      talent.er ?? null,
      talent.lockedFinal ?? null,
      IMOK_ID,
    ],
  )
  await db.query('DELETE FROM creator_categories WHERE creator_id = $1', [talent.id])
  for (const slug of talent.categories) {
    await db.query(
      `INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [talent.id, slug],
    )
  }
  await db.query('DELETE FROM collaborations WHERE creator_id = $1', [talent.id])
  for (const [index, col] of (talent.brands ?? []).entries()) {
    await db.query(
      `INSERT INTO collaborations (id, creator_id, brand, happened_at, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET brand = EXCLUDED.brand, happened_at = EXCLUDED.happened_at, note = EXCLUDED.note`,
      [`col_${talent.id}_${index + 1}`, talent.id, col.brand, col.at, col.note ?? null],
    )
  }
  await db.query('DELETE FROM prices WHERE creator_id = $1', [talent.id])
  if (talent.price) {
    await db.query(
      `INSERT INTO prices (id, creator_id, amount_min, amount_max, currency, unit)
       VALUES ($1,$2,$3,$4,$5,'per_post')
       ON CONFLICT (id) DO UPDATE SET
         amount_min = EXCLUDED.amount_min,
         amount_max = EXCLUDED.amount_max,
         currency = EXCLUDED.currency`,
      [`price_${talent.id}`, talent.id, talent.price.min, talent.price.max ?? null, talent.price.currency],
    )
  }
}

export async function seed(db: Db, opts: { reset?: boolean; store?: ObjectStore } = {}): Promise<SeedCounts> {
  if (opts.reset) {
    await db.query(`
      TRUNCATE TABLE
        company_collaborators, company_creator_attrs, company_dataset_rows, company_rule_packs,
        audit_logs, reviews, shortlist_items, assignments, projects,
        prices, collaborations, creator_categories, creators, assets,
        ingest_jobs, ingest_sources, sessions, "user", users, orgs, categories
      RESTART IDENTITY CASCADE
    `)
  }

  const companies = [
    {
      id: IMOK_ID,
      name: 'IMOK',
      slug: 'imok',
      budget: '试水单笔 ≤80000 CNY',
      prefs: { currency: 'CNY', locale: 'zh-CN', defaultSort: 'rating' },
    },
    {
      id: HANSOUL_ID,
      name: '韩颂',
      slug: 'hansoul',
      budget: null,
      prefs: { currency: 'USD', locale: 'en', defaultSort: 'followers' },
    },
    {
      id: PLATFORM_ID,
      name: '全球达人情报',
      slug: 'platform',
      budget: '试水单笔 ≤80000 CNY',
      prefs: { currency: 'KRW', locale: 'ko', defaultSort: 'rating' },
    },
  ]
  for (const company of companies) {
    await db.query(
      `INSERT INTO orgs (id, name, budget_note, slug, prefs) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         prefs = EXCLUDED.prefs,
         budget_note = COALESCE(orgs.budget_note, EXCLUDED.budget_note)`,
      [company.id, company.name, company.budget, company.slug, JSON.stringify(company.prefs)],
    )
  }

  const homeOrg = (role: string) =>
    role === 'ops' || role === 'selector' || role === 'selector_viewer' ? IMOK_ID : PLATFORM_ID

  for (const user of SEED_USERS) {
    await db.query(
      `INSERT INTO users (id, org_id, email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         role = EXCLUDED.role,
         display_name = EXCLUDED.display_name,
         org_id = EXCLUDED.org_id`,
      [
        `user_${user.role}`,
        homeOrg(user.role),
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
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, org_id = EXCLUDED.org_id`,
      [extra.id, homeOrg(extra.role), extra.email, hashPassword('KcsE2e!2026'), extra.role, extra.name],
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

  for (const job of JOBS) {
    const started = new Date(Date.now() - job.hoursAgo * 3600 * 1000)
    const ended = job.status === 'running' || job.status === 'queued' ? null : new Date(started.getTime() + 12 * 60 * 1000)
    await db.query(
      `INSERT INTO ingest_jobs (
          id, source_id, schedule, status, attempt, written_count, skipped_dupes, failed_count,
          error_code, error_summary, opened_by, file_name, batch_name, source_rows, started_at, ended_at,
          created_at, updated_at
        ) VALUES (
          $1,'file-drop','once',$2,$3,$4,$5,$6,$7,$8,'user_devops',$9,$10,$11,$12,$13,$12,now()
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          attempt = EXCLUDED.attempt,
          written_count = EXCLUDED.written_count,
          skipped_dupes = EXCLUDED.skipped_dupes,
          failed_count = EXCLUDED.failed_count,
          error_code = EXCLUDED.error_code,
          error_summary = EXCLUDED.error_summary,
          file_name = EXCLUDED.file_name,
          batch_name = EXCLUDED.batch_name,
          source_rows = EXCLUDED.source_rows,
          started_at = EXCLUDED.started_at,
          ended_at = EXCLUDED.ended_at,
          created_at = EXCLUDED.created_at,
          updated_at = now()`,
      [
        job.id,
        job.status,
        job.attempt,
        job.written,
        job.skipped,
        job.failed,
        job.errorCode ?? null,
        job.errorSummary ?? null,
        job.fileName ?? null,
        job.batchName ?? null,
        job.sourceRows ?? null,
        started.toISOString(),
        ended?.toISOString() ?? null,
      ],
    )
  }

  for (const talent of TALENTS) {
    await upsertTalent(db, talent)
    await attachTalentMedia(db, talent, opts.store)
  }

  for (const project of PROJECTS) {
    await db.query(
      `INSERT INTO projects (id, org_id, name, note, status)
       VALUES ($1,$2,$3,$4,'open')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, note = EXCLUDED.note, status = 'open', updated_at = now()`,
      [project.id, IMOK_ID, project.name, project.note],
    )
    await db.query('DELETE FROM assignments WHERE project_id = $1', [project.id])
    for (const member of project.members) {
      await db.query(
        `INSERT INTO assignments (id, project_id, creator_id, status, assigned_by, note)
         VALUES ($1,$2,$3,'assigned','user_selector',$4)
         ON CONFLICT (project_id, creator_id) DO UPDATE SET
           status = 'assigned',
           note = EXCLUDED.note,
           assigned_by = EXCLUDED.assigned_by`,
        [`asgn_${project.id}_${member.creatorId}`, project.id, member.creatorId, member.note],
      )
    }
  }

  const imported = await importImokPink(db, IMOK_ID)
  const pink = await db.query<{ id: string; display_name: string; verticals: string[] }>(
    `SELECT id, display_name, verticals FROM creators WHERE id LIKE 'creator_imok_%'`,
  )
  for (const row of pink.rows) {
    await attachTalentMedia(
      db,
      { id: row.id, name: row.display_name, verticals: row.verticals ?? [] },
      opts.store,
    )
  }

  const emails = SEED_USERS.map((u) => u.email)
  const users = await db.query('SELECT count(*)::int AS n FROM users WHERE email = ANY($1)', [emails])
  const talents = await db.query(`SELECT count(*)::int AS n FROM creators WHERE id LIKE 'seed_%'`)
  const unpublished = await db.query(
    `SELECT count(*)::int AS n FROM creators WHERE id LIKE 'seed_%' AND status <> 'released'`,
  )
  const projects = await db.query(`SELECT count(*)::int AS n FROM projects WHERE id LIKE 'seed_proj_%'`)
  const assignments = await db.query(
    `SELECT count(*)::int AS n FROM assignments WHERE project_id LIKE 'seed_proj_%'`,
  )
  const ingestJobs = await db.query(`SELECT count(*)::int AS n FROM ingest_jobs WHERE id LIKE 'job_seed_%'`)

  return {
    users: users.rows[0].n,
    talents: talents.rows[0].n,
    unpublished: unpublished.rows[0].n,
    projects: projects.rows[0].n,
    assignments: assignments.rows[0].n,
    ingestJobs: ingestJobs.rows[0].n,
    imported,
  }
}
