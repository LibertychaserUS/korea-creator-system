/**
 * Assumed 千瓜 bearer API paths: data.author.*, data.metrics_30d.*,
 * data.commercial.*. FIELD_MAP also includes common flat responses and the
 * fixture's Chinese names, so schema corrections do not change transform code.
 */
import type { SourceAdapter, SourceQuery } from '@kcs/contract'
import { fetchJsonPage, filterFixturePage, fixturePage, normalizeRecord, type AdapterPage, type FieldMap } from './common'

export const FIELD_MAP: FieldMap = {
  externalId: ['达人ID', 'data.author.id', 'author_id', 'user_id'],
  displayName: ['昵称', 'data.author.name', 'name'],
  xhsId: ['小红书号', 'data.author.xhs_id', 'xhs_id'],
  avatarUrl: ['头像', 'data.author.avatar', 'avatar'],
  regions: ['地区', 'data.author.region', 'region'],
  verticals: ['垂类', 'data.author.categories', 'category'],
  followers: ['粉丝数', 'data.metrics_30d.followers', 'followers'],
  followerGrowth: ['涨粉', 'data.metrics_30d.follower_growth', 'follower_growth'],
  readMedian: ['阅读中位数', 'data.metrics_30d.read_median', 'read_median'],
  interactionMedian: ['互动中位数', 'data.metrics_30d.interaction_median', 'interaction_median'],
  likeMedian: ['点赞中位数', 'data.metrics_30d.like_median'],
  collectMedian: ['收藏中位数', 'data.metrics_30d.collect_median'],
  commentMedian: ['评论中位数', 'data.metrics_30d.comment_median'],
  noteCount: ['近30天发文', 'data.metrics_30d.note_count', 'note_count'],
  viralCount: ['爆文数', 'data.metrics_30d.viral_count', 'viral_count'],
  priceImage: ['预估报价', 'data.commercial.estimated_price', 'estimated_price'],
  cpe: ['CPE', 'data.commercial.cpe', 'cpe'],
  cpm: ['CPM', 'data.commercial.cpm', 'cpm'],
  authenticity: ['粉丝真实度', 'data.metrics_30d.authenticity', 'authenticity'],
  vendorIndex: ['千瓜指数', 'data.index', 'index'],
  coopBrands: ['合作品牌', 'data.commercial.brands', 'brands'],
  health: ['健康等级', 'data.metrics_30d.health', 'health'],
}

export const qianguaAdapter: SourceAdapter = {
  id: 'qiangua',
  supports: ['window', 'keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax', 'externalIds', 'cursor', 'limit'],
  provides: ['followers', 'followerGrowth', 'followerGrowthRate', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian', 'engagementRate', 'noteCount', 'viralCount', 'viralRate', 'priceImage', 'cpe', 'cpm', 'collectLikeRatio', 'readToFollowerRatio', 'authenticity', 'vendorIndex', 'coopBrands', 'health'],
  async fetch(query: SourceQuery): Promise<AdapterPage> {
    const token = process.env.QIANGUA_TOKEN
    if (!token) {
      const page = fixturePage('qiangua', new URL('./fixtures/qiangua.json', import.meta.url), query)
      return filterFixturePage(page, query, (raw) => normalizeRecord(raw, FIELD_MAP, ['authenticity']))
    }
    return fetchJsonPage({
      source: 'qiangua',
      url: `${process.env.QIANGUA_BASE_URL || 'https://api.qiangua.com'}/v1/xhs/creators/search`,
      query,
      headers: { authorization: `Bearer ${token}` },
    })
  },
  normalize(raw) {
    return normalizeRecord(raw, FIELD_MAP, ['authenticity'])
  },
}
