/**
 * 千瓜 adapter (route B, vendor).
 *
 * Status of the source (checked 2026-09): 千瓜 publishes no public API
 * documentation — data access is an enterprise contract (「达人管理 / 数据接口」
 * via sales), and the field list arrives with that contract. Nothing here is
 * therefore "the" 千瓜 schema; FIELD_MAP holds the vendor's Chinese export
 * column names (达人搜索 导出 口径) plus common flat aliases, and can be
 * replaced at deploy time with `QIANGUA_FIELD_MAP` (JSON) once the real
 * response is in hand. Endpoint = `QIANGUA_BASE_URL` + `QIANGUA_SEARCH_PATH`.
 *
 * 千瓜-specific fields worth keeping: 千瓜指数 (vendorIndex, 0-1000),
 * 粉丝真实度 (authenticity), 爆文数 / 爆文率 (viralCount / viralRate),
 * 粉丝量级 (head ≥50万 / mid ≥5万 / junior ≥5千 / amateur ≥300 → CREATOR_TIERS).
 */
import type { FetchContext, SourceAdapter, SourceQuery } from '@kcs/contract'
import {
  fetchJsonPage,
  fieldMapFromEnv,
  filterFixturePage,
  fixturePage,
  normalizeRecord,
  type AdapterPage,
  type FieldMap,
} from './common'

const DEFAULT_FIELD_MAP: FieldMap = {
  externalId: ['达人ID', 'author_id', 'user_id', 'id'],
  displayName: ['昵称', '达人昵称', 'nickname', 'name'],
  xhsId: ['小红书号', 'xhs_id', 'red_id'],
  avatarUrl: ['头像', 'avatar'],
  regions: ['地区', 'IP属地', 'region', 'location'],
  verticals: ['垂类', '达人分类', 'category', 'tags'],
  followers: ['粉丝数', 'followers', 'fans_count'],
  followerGrowth: ['涨粉', '近30天涨粉', 'follower_growth', 'fans_increase'],
  readMedian: ['阅读中位数', 'read_median'],
  interactionMedian: ['互动中位数', 'interaction_median'],
  likeMedian: ['点赞中位数', 'like_median'],
  collectMedian: ['收藏中位数', 'collect_median'],
  commentMedian: ['评论中位数', 'comment_median'],
  noteCount: ['近30天发文', '笔记数', 'note_count'],
  viralCount: ['爆文数', 'viral_count', 'hot_note_count'],
  viralRate: { paths: ['爆文率', 'viral_rate'], unit: 'percent' },
  priceImage: ['预估报价', '图文报价', 'estimated_price', 'price_image'],
  priceVideo: ['视频报价', 'price_video'],
  cpe: ['CPE', 'cpe'],
  // 千瓜「CPM」is per 1,000 reads, not impressions.
  cpmRead: ['CPM', 'cpm', 'cpm_read'],
  authenticity: { paths: ['粉丝真实度', 'authenticity', 'real_fans_ratio'], unit: 'percent' },
  vendorIndex: ['千瓜指数', 'index', 'qiangua_index'],
  coopBrands: ['合作品牌', 'brands', 'coop_brands'],
  health: ['健康等级', 'health'],
}

export const FIELD_MAP: FieldMap = fieldMapFromEnv('QIANGUA_FIELD_MAP', DEFAULT_FIELD_MAP)

export const qianguaAdapter: SourceAdapter = {
  id: 'qiangua',
  supports: ['window', 'keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax', 'externalIds', 'cursor', 'limit'],
  provides: ['followers', 'followerGrowth', 'followerGrowthRate', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian', 'engagementRate', 'noteCount', 'viralCount', 'viralRate', 'priceImage', 'priceVideo', 'cpe', 'cpmRead', 'collectLikeRatio', 'readToFollowerRatio', 'authenticity', 'vendorIndex', 'coopBrands', 'health'],
  metered: true,
  async fetch(query: SourceQuery, context?: FetchContext): Promise<AdapterPage> {
    const token = process.env.QIANGUA_TOKEN
    if (!token) {
      const page = fixturePage('qiangua', new URL('./fixtures/qiangua.json', import.meta.url), query)
      return filterFixturePage(page, query, (raw) => normalizeRecord(raw, FIELD_MAP))
    }
    const base = (process.env.QIANGUA_BASE_URL || 'https://api.qian-gua.com').replace(/\/$/, '')
    const path = process.env.QIANGUA_SEARCH_PATH || '/v1/xhs/creators/search'
    return fetchJsonPage({
      source: 'qiangua',
      url: `${base}${path}`,
      query,
      context,
      headers: { authorization: `Bearer ${token}` },
    })
  },
  normalize(raw) {
    return normalizeRecord(raw, FIELD_MAP)
  },
}
