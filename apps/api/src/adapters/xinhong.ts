/**
 * Assumed 新红 bearer API paths: result.author.*, result.stat.*, result.quote.*.
 * Flat aliases and fixture names are intentionally kept in FIELD_MAP; update
 * paths here after validating the customer's vendor plan and API version.
 */
import type { SourceAdapter, SourceQuery } from '@kcs/contract'
import { fetchJsonPage, filterFixturePage, fixturePage, normalizeRecord, type AdapterPage, type FieldMap } from './common'

export const FIELD_MAP: FieldMap = {
  externalId: ['达人ID', 'result.author.id', 'user_id', 'author_id'],
  displayName: ['昵称', 'result.author.nickname', 'nickname', 'name'],
  xhsId: ['小红书号', 'result.author.xhs_id', 'xhs_id'],
  avatarUrl: ['头像', 'result.author.avatar', 'avatar'],
  regions: ['地区', 'result.author.region', 'region'],
  verticals: ['垂类', 'result.author.tags', 'tags'],
  followers: ['粉丝数', 'result.stat.followers', 'followers'],
  followerGrowth: ['近30天涨粉', '涨粉', 'result.stat.follower_growth_30d'],
  impressionMedian: ['曝光中位数', 'result.stat.impression_median'],
  readMedian: ['阅读中位数', 'result.stat.read_median'],
  interactionMedian: ['互动中位数', 'result.stat.interaction_median'],
  likeMedian: ['点赞中位数', 'result.stat.like_median'],
  collectMedian: ['收藏中位数', 'result.stat.collect_median'],
  commentMedian: ['评论中位数', 'result.stat.comment_median'],
  noteCount: ['近30天发文', 'result.stat.note_count_30d'],
  viralCount: ['爆文数', 'result.stat.viral_count_30d'],
  priceImage: ['图文报价', '预估报价', 'result.quote.image'],
  priceVideo: ['视频报价', 'result.quote.video'],
  cpe: ['CPE', 'result.quote.cpe'],
  cpm: ['CPM', 'result.quote.cpm'],
  authenticity: ['粉丝真实度', 'result.stat.real_fan_ratio'],
  vendorIndex: ['新红指数', 'result.index', 'index'],
  coopBrands: ['合作品牌', 'result.commercial.brands'],
  health: ['健康等级', 'result.stat.health'],
}

export const xinhongAdapter: SourceAdapter = {
  id: 'xinhong',
  supports: ['window', 'keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax', 'externalIds', 'cursor', 'limit'],
  provides: ['followers', 'followerGrowth', 'followerGrowthRate', 'impressionMedian', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian', 'engagementRate', 'noteCount', 'viralCount', 'viralRate', 'priceImage', 'priceVideo', 'cpe', 'cpm', 'collectLikeRatio', 'readToFollowerRatio', 'authenticity', 'vendorIndex', 'coopBrands', 'health'],
  async fetch(query: SourceQuery): Promise<AdapterPage> {
    const token = process.env.XINHONG_TOKEN
    if (!token) {
      const page = fixturePage('xinhong', new URL('./fixtures/xinhong.json', import.meta.url), query)
      return filterFixturePage(page, query, (raw) => normalizeRecord(raw, FIELD_MAP, ['authenticity']))
    }
    return fetchJsonPage({
      source: 'xinhong',
      url: `${process.env.XINHONG_BASE_URL || 'https://api.newrank.cn/xinhong'}/v1/creators/search`,
      query,
      headers: { authorization: `Bearer ${token}` },
    })
  },
  normalize(raw) {
    return normalizeRecord(raw, FIELD_MAP, ['authenticity'])
  },
}
