import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type RawRecord, type SourceAdapter, type SourceId } from '@kcs/contract'
import { persistPage } from '../src/ingest/persist'
import {
  DEFAULT_TREND_CONFIG,
  engagementOutlierHint,
  logFollowerSlope,
  seriesHints,
  trendConfig,
} from '../src/ingest/trends'
import { createTestApp, type TestCtx } from './helpers'

const day = (n: number) => new Date(Date.UTC(2026, 7, 1) + n * 86_400_000).toISOString()

describe('log-follower slope', () => {
  it('recovers a steady daily growth rate', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ fetchedAt: day(i * 3), followers: 10_000 * 1.01 ** (i * 3) }))
    const slope = logFollowerSlope(points)!
    expect(slope.perDay).toBeCloseTo(Math.log(1.01), 8)
    expect(slope.growth30d).toBeCloseTo(1.01 ** 30 - 1, 6)
    expect(slope.r2).toBeCloseTo(1, 8)
    expect(slope).toMatchObject({ points: 10, spanDays: 27 })
  })

  it('needs 3 usable points over 7 days; flat is zero with no fit to report', () => {
    expect(logFollowerSlope([{ fetchedAt: day(0), followers: 1 }, { fetchedAt: day(9), followers: 2 }])).toBeNull()
    expect(logFollowerSlope([0, 2, 4].map((n) => ({ fetchedAt: day(n), followers: 100 + n })))).toBeNull()
    expect(logFollowerSlope([0, 5, 10, 12].map((n, i) => ({ fetchedAt: day(n), followers: i === 1 ? null : i === 3 ? 0 : 500 })))).toBeNull()
    expect(logFollowerSlope([0, 5, 10].map((n) => ({ fetchedAt: day(n), followers: 500 })))).toMatchObject({ perDay: 0, growth30d: 0, r2: null })
  })

  it('a falling account has a negative slope', () => {
    const slope = logFollowerSlope([0, 7, 14, 21].map((n) => ({ fetchedAt: day(n), followers: 50_000 * Math.exp(-0.01 * n) })))!
    expect(slope.perDay).toBeCloseTo(-0.01, 8)
    expect(slope.growth30d).toBeLessThan(0)
  })
})

describe('hints', () => {
  const point = (n: number, followers: number | null, interactionMedian: number | null = null) =>
    ({ fetchedAt: day(n), followers, interactionMedian })

  it('flags the biggest jump and drop between close snapshots, in three languages', () => {
    const hints = seriesHints('qiangua', [point(0, 10_000), point(7, 10_500), point(14, 13_500), point(21, 13_000), point(28, 9_000)])
    expect(hints.map((hint) => hint.kind)).toEqual(['follower_jump', 'follower_drop'])
    expect(hints[0]!.params).toMatchObject({ days: 7, from: 10_500, to: 13_500, date: '2026-08-15' })
    expect(hints[0]!.messages['zh-CN']).toBe('2026-08-15 前后 7 天内粉丝涨了 29%（10,500 → 13,500），可以看看是否有投放或活动')
    expect(hints[0]!.messages.en).toContain('Followers rose 29% in 7 days')
    expect(hints[0]!.messages.ko).toContain('7일 만에 팔로워가 29% 늘었습니다')
    expect(hints[1]!.messages['zh-CN']).toContain('粉丝掉了 31%')
  })

  it('ignores moves spread over more than two weeks and small wobbles', () => {
    expect(seriesHints('qiangua', [point(0, 10_000), point(30, 20_000)])).toEqual([])
    expect(seriesHints('qiangua', [point(0, 10_000), point(3, 11_000), point(6, 10_200)])).toEqual([])
  })

  it('followers up while interactions go down', () => {
    const hints = seriesHints('pugongying', [point(0, 10_000, 500), point(10, 10_400, 420), point(20, 10_800, 350)])
    expect(hints).toEqual([expect.objectContaining({
      kind: 'followers_up_engagement_down',
      params: { days: 20, followers: 0.08, interactions: -0.3 },
    })])
    expect(hints[0]!.messages['zh-CN']).toBe('近 20 天粉丝涨了 8%，互动却降了 30%')
    expect(seriesHints('pugongying', [point(0, 10_000, 500), point(10, 10_800, 350)])).toEqual([])
  })

  it('engagement far above the same tier, only with a big enough group', () => {
    expect(engagementOutlierHint('qiangua', 0.12, { median: 0.03, size: 29 })).toBeNull()
    expect(engagementOutlierHint('qiangua', 0.08, { median: 0.03, size: 40 })).toBeNull()
    const hint = engagementOutlierHint('qiangua', 0.12, { median: 0.03, size: 40 })!
    expect(hint.params).toMatchObject({ factor: 4, groupSize: 40 })
    expect(hint.messages['zh-CN']).toBe('互动率是同量级博主一般水平的 4.0 倍（本库 40 人），明显偏高，建议核实')
  })

  it('reads overrides from TREND_CONFIG, ignoring junk', () => {
    expect(trendConfig({ TREND_CONFIG: '{"jumpRatio":0.3,"outlierMinGroup":-1}' })).toEqual({ ...DEFAULT_TREND_CONFIG, jumpRatio: 0.3 })
    expect(trendConfig({ TREND_CONFIG: 'nope' })).toEqual(DEFAULT_TREND_CONFIG)
  })
})

const RUN = `tr${Date.now().toString(36)}`

function adapterFor(id: SourceId): SourceAdapter {
  return {
    id,
    supports: ['externalIds'],
    provides: ['followers'],
    async fetch() {
      return { records: [], nextCursor: null }
    },
    normalize(record) {
      return {
        ok: true,
        creator: {
          creatorKey: creatorKeyFor(id, record.externalId),
          externalId: record.externalId,
          platform: 'xhs',
          displayName: `趋势 ${record.externalId}`,
          xhsId: (record.payload.xhs as string | undefined) ?? null,
          avatarUrl: null,
          regions: [],
          verticals: [],
          metrics: {
            ...emptyMetrics(30),
            followers: Number(record.payload.fans),
            engagementRate: record.payload.er == null ? null : Number(record.payload.er),
          },
          warnings: [],
        },
      }
    },
  }
}

describe('trends against the database', () => {
  let ctx: TestCtx
  const auth = { authorization: 'Bearer test:ops@kcs.local' }
  const write = (source: SourceId, externalId: string, payload: Record<string, unknown>, at: string) => {
    const record: RawRecord = { source, platform: 'xhs', externalId, fetchedAt: at, payload }
    return persistPage(ctx.env, adapterFor(source), { records: [record], nextCursor: null }, null, source)
  }
  const get = async (path: string, headers: Record<string, string> = auth) => {
    const response = await ctx.app.request(path, { headers })
    return { status: response.status, json: await response.json() }
  }

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('keeps each source on its own line, with its own slope', async () => {
    const xhs = `${RUN}_two`
    for (const [n, pgy, qg] of [[0, 680_000, 530_000], [7, 684_000, 531_000], [14, 690_000, 533_000]] as const) {
      await write('pugongying', `${RUN}-pgy`, { fans: pgy, xhs }, day(n))
      await write('qiangua', `${RUN}-qg`, { fans: qg, xhs }, day(n + 1))
    }
    const creatorId = (await ctx.db.query('SELECT id FROM creators WHERE xhs_id = $1', [xhs])).rows[0].id
    const { status, json } = await get(`/api/ingest/trends/${creatorId}`)
    expect(status).toBe(200)
    expect(json.series.map((s: { source: string }) => s.source)).toEqual(['pugongying', 'qiangua'])
    for (const series of json.series) {
      expect(series.snapshots).toHaveLength(3)
      expect(new Set(series.snapshots.map((snapshot: { source: string }) => snapshot.source))).toEqual(new Set([series.source]))
      expect(series.followerSlope.growth30d).toBeGreaterThan(0)
    }
    // Mixed on one line this would read as a 22% drop.
    expect(json.hints.filter((hint: { kind: string }) => hint.kind === 'follower_drop')).toEqual([])
    expect(json.primarySource).toBe('qiangua')

    const only = await get(`/api/ingest/trends/${creatorId}?source=pugongying&limit=2`)
    expect(only.json.series).toHaveLength(1)
    expect(only.json.series[0].snapshots.map((snapshot: { metrics: { followers: number } }) => snapshot.metrics.followers))
      .toEqual([684_000, 690_000])
  })

  it('compares engagement with the same source, window and tier', async () => {
    for (let i = 0; i < 30; i += 1) {
      await write('xinhong', `${RUN}-peer-${i}`, { fans: 20_000 + i * 100, er: 0.02 + (i % 3) * 0.001 }, day(40))
    }
    await write('xinhong', `${RUN}-hot`, { fans: 21_000, er: 0.1 }, day(40))
    const creatorId = (await ctx.db.query(
      "SELECT creator_id FROM creator_sources WHERE source = 'xinhong' AND external_id = $1",
      [`${RUN}-hot`],
    )).rows[0].creator_id
    const { json } = await get(`/api/ingest/trends/${creatorId}`)
    const hint = json.hints.find((candidate: { kind: string }) => candidate.kind === 'engagement_outlier')
    expect(hint).toMatchObject({ source: 'xinhong' })
    expect(hint.params.groupSize).toBeGreaterThanOrEqual(31) // plus any demo creators in the same tier
    expect(hint.params.factor).toBeGreaterThanOrEqual(4.5)
  })

  it('404 for nobody, ingest rights only', async () => {
    expect((await get('/api/ingest/trends/nobody')).status).toBe(404)
    expect((await get('/api/ingest/trends/nobody', { authorization: 'Bearer test:selector@kcs.local' })).status).toBe(403)
  })
})
