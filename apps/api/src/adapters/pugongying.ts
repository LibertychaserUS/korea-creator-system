/**
 * Assumed 蒲公英 OpenAPI paths: creator.{id,name,xhs_id,avatar}, metrics.30d.*,
 * quote.{image,video}, audience.*, cooperation.brands. Keep FIELD_MAP editable
 * when an account's actual OpenAPI schema/version is known.
 */
import type { SourceAdapter, SourceQuery } from '@kcs/contract'
import { fetchJsonPage, filterFixturePage, fixturePage, normalizeRecord, type AdapterPage, type FieldMap } from './common'

export const FIELD_MAP: FieldMap = {
  externalId: ['博主ID', 'creator.id', 'author_id', 'id'],
  displayName: ['博主名称', '昵称', 'creator.name', 'name'],
  xhsId: ['小红书号', 'creator.xhs_id', 'xhs_id'],
  avatarUrl: ['头像', 'creator.avatar', 'avatar'],
  regions: ['地区', 'creator.regions', 'region'],
  verticals: ['垂类', 'creator.categories', 'category'],
  followers: ['粉丝数', 'metrics.30d.followers', 'followers'],
  followerGrowth: ['涨粉', 'metrics.30d.follower_growth', 'follower_growth'],
  readFanRatio: ['阅读粉丝占比', 'metrics.30d.read_fan_ratio'],
  activeFanRatio: ['活跃粉丝占比', 'metrics.30d.active_fan_ratio'],
  impressionMedian: ['曝光中位数', 'metrics.30d.impression_median'],
  readMedian: ['阅读中位数', 'metrics.30d.read_median'],
  interactionMedian: ['互动中位数', 'metrics.30d.interaction_median'],
  likeMedian: ['点赞中位数', 'metrics.30d.like_median'],
  collectMedian: ['收藏中位数', 'metrics.30d.collect_median'],
  commentMedian: ['评论中位数', 'metrics.30d.comment_median'],
  coopReadMedian: ['合作阅读中位数', 'cooperation.read_median'],
  coopInteractionMedian: ['合作互动中位数', 'cooperation.interaction_median'],
  engagementRate: ['互动率', 'metrics.30d.engagement_rate'],
  priceImage: ['图文报价', 'quote.image'],
  priceVideo: ['视频报价', 'quote.video'],
  cpv: ['预估阅读成本', 'quote.cpv'],
  cpe: ['CPE', 'quote.cpe'],
  health: ['健康等级', 'metrics.30d.health'],
  coopBrands: ['合作品牌', 'cooperation.brands'],
}

export const pugongyingAdapter: SourceAdapter = {
  id: 'pugongying',
  supports: ['window', 'keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax', 'health', 'externalIds', 'cursor', 'limit'],
  provides: ['followers', 'followerGrowth', 'followerGrowthRate', 'readFanRatio', 'activeFanRatio', 'impressionMedian', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian', 'coopReadMedian', 'coopInteractionMedian', 'engagementRate', 'priceImage', 'priceVideo', 'cpv', 'cpe', 'cpm', 'collectLikeRatio', 'readToFollowerRatio', 'health', 'coopBrands'],
  async fetch(query: SourceQuery): Promise<AdapterPage> {
    const appId = process.env.PGY_APP_ID
    const secret = process.env.PGY_APP_SECRET
    const token = process.env.PGY_ACCESS_TOKEN
    if (!appId || !secret || !token) {
      const page = fixturePage('pugongying', new URL('./fixtures/pugongying.json', import.meta.url), query)
      return filterFixturePage(page, query, (raw) =>
        normalizeRecord(raw, FIELD_MAP, ['readFanRatio', 'activeFanRatio', 'engagementRate']))
    }
    return fetchJsonPage({
      source: 'pugongying',
      url: `${process.env.PGY_BASE_URL || 'https://ad-market.xiaohongshu.com/openapi'}/creator/search`,
      query,
      headers: { authorization: `Bearer ${token}`, 'x-app-id': appId, 'x-app-secret': secret },
    })
  },
  normalize(raw) {
    return normalizeRecord(raw, FIELD_MAP, ['readFanRatio', 'activeFanRatio', 'engagementRate'])
  },
}
