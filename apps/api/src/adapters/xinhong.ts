/**
 * 新红 adapter (route B, vendor; 新榜 group).
 *
 * Status of the source (checked 2026-09): 新榜 sells a data API
 * (api.newrank.cn, header `Key: <apiKey>`, form-encoded POST, endpoints under
 * `/api/sync/<platform>/...`), but the endpoint list and field docs live in the
 * paid console (newrank.cn 数据API → 控制台) and are not public. The 小红书
 * (新红) endpoints must be copied from that console after purchase, so this
 * adapter keeps the transport and endpoint configurable:
 *   XINHONG_BASE_URL     default https://api.newrank.cn
 *   XINHONG_SEARCH_PATH  e.g. /api/sync/xh/account/search   (from the console)
 *   XINHONG_FIELD_MAP    JSON override of the default field paths below
 *
 * 新红-specific fields worth keeping: 新红指数 (vendorIndex), 互动粉丝比,
 * 品牌合作数据 (coopBrands), cpe from 投放分析.
 */
import type { SourceAdapter, SourceQuery } from '@kcs/contract'
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
  externalId: ['达人ID', 'user_id', 'author_id', 'accountId', 'id'],
  displayName: ['昵称', 'nickname', 'name'],
  xhsId: ['小红书号', 'xhs_id', 'redId'],
  avatarUrl: ['头像', 'avatar', 'headPhoto'],
  regions: ['地区', 'region', 'location', 'ipLocation'],
  verticals: ['垂类', 'tags', 'category', 'contentTags'],
  followers: ['粉丝数', 'followers', 'fansCount', 'fans'],
  followerGrowth: ['近30天涨粉', '涨粉', 'follower_growth_30d', 'fansIncrease'],
  impressionMedian: ['曝光中位数', 'impression_median'],
  readMedian: ['阅读中位数', 'read_median', 'readMedian'],
  interactionMedian: ['互动中位数', 'interaction_median', 'interactionMedian'],
  likeMedian: ['点赞中位数', 'like_median', 'likeMedian'],
  collectMedian: ['收藏中位数', 'collect_median', 'collectMedian'],
  commentMedian: ['评论中位数', 'comment_median', 'commentMedian'],
  noteCount: ['近30天发文', 'note_count_30d', 'noteCount'],
  viralCount: ['爆文数', 'viral_count_30d', 'hotNoteCount'],
  priceImage: ['图文报价', '预估报价', 'price_image', 'picturePrice'],
  priceVideo: ['视频报价', 'price_video', 'videoPrice'],
  cpe: ['CPE', 'cpe'],
  cpm: ['CPM', 'cpm'],
  engagedFanRatio: { paths: ['互动粉丝比', 'engaged_fan_ratio'], unit: 'percent' },
  authenticity: { paths: ['粉丝真实度', 'real_fan_ratio', 'authenticity'], unit: 'percent' },
  vendorIndex: ['新红指数', 'index', 'xinhongIndex'],
  coopBrands: ['合作品牌', 'brands', 'coopBrands'],
  health: ['健康等级', 'health'],
}

export const FIELD_MAP: FieldMap = fieldMapFromEnv('XINHONG_FIELD_MAP', DEFAULT_FIELD_MAP)

export const xinhongAdapter: SourceAdapter = {
  id: 'xinhong',
  supports: ['window', 'keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax', 'externalIds', 'cursor', 'limit'],
  provides: ['followers', 'followerGrowth', 'followerGrowthRate', 'impressionMedian', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian', 'engagementRate', 'engagedFanRatio', 'noteCount', 'viralCount', 'viralRate', 'priceImage', 'priceVideo', 'cpe', 'cpm', 'collectLikeRatio', 'readToFollowerRatio', 'authenticity', 'vendorIndex', 'coopBrands', 'health'],
  async fetch(query: SourceQuery): Promise<AdapterPage> {
    const token = process.env.XINHONG_TOKEN
    if (!token) {
      const page = fixturePage('xinhong', new URL('./fixtures/xinhong.json', import.meta.url), query)
      return filterFixturePage(page, query, (raw) => normalizeRecord(raw, FIELD_MAP))
    }
    const base = (process.env.XINHONG_BASE_URL || 'https://api.newrank.cn').replace(/\/$/, '')
    const path = process.env.XINHONG_SEARCH_PATH || '/api/sync/xh/account/search'
    return fetchJsonPage({
      source: 'xinhong',
      url: `${base}${path}`,
      query,
      // 新榜 data API authenticates with a `Key` header rather than Bearer.
      headers: { Key: token },
      encoding: 'form',
    })
  },
  normalize(raw) {
    return normalizeRecord(raw, FIELD_MAP)
  },
}
