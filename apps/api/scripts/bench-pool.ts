/**
 * Pool latency with a realistic number of published creators.
 *
 *   BENCH_DATABASE_URL=postgres://kcs:kcs@127.0.0.1:5432/kcs_a_bench BENCH_CREATORS=50000 \
 *     pnpm --filter @kcs/api exec tsx scripts/bench-pool.ts
 *
 * Resets the target database (seed reset + BENCH_CREATORS extra released
 * creators, default 5000, spread over 3 sources × 2 windows × 2 content forms
 * so percentiles are computed per group as in production), rebuilds the pool
 * table (`refreshPublished`), then times the select-side read paths and one
 * publish. Prints a Markdown table. Never point it at a database whose data
 * you want to keep.
 */
import { randomUUID } from 'node:crypto'
import { deriveMetrics, emptyMetrics, pageCount, PAGE_SIZE_DEFAULT, SOURCE_IDS, defaultSavedQuery, type SavedQuery } from '@kcs/contract'
import { createApp } from '../src/app'
import { connectDb } from '../src/db'
import { migrate } from '../src/migrate'
import { ensurePublishedSnapshots } from '../src/http/pool'
import { refreshPublished } from '../src/http/published'
import { seed } from '../src/seed'
import { MemoryObjectStore } from '../src/store'

const url = process.env.BENCH_DATABASE_URL
if (!url) throw new Error('BENCH_DATABASE_URL is required (the database is reset)')
const total = Number(process.env.BENCH_CREATORS || 5000)
const rounds = Number(process.env.BENCH_ROUNDS || 7)

const db = await connectDb(url)
await migrate(db)
await seed(db, { reset: true })

let seedValue = 42
function rand() {
  seedValue = (seedValue * 1_103_515_245 + 12_345) % 2 ** 31
  return seedValue / 2 ** 31
}

const loadStarted = performance.now()
const BATCH = 500
for (let offset = 0; offset < total; offset += BATCH) {
  const values: unknown[] = []
  const tuples: string[] = []
  for (let i = offset; i < Math.min(total, offset + BATCH); i += 1) {
    // Log-uniform followers (300 – 1M), like a real library: many small, few big.
    const followers = Math.round(300 * Math.exp(rand() * Math.log(1_000_000 / 300)))
    const readMedian = Math.round(followers * (0.02 + rand() * 0.2))
    const source = SOURCE_IDS[Math.floor(rand() * SOURCE_IDS.length)]
    const metrics = deriveMetrics({
      ...emptyMetrics(rand() < 0.2 ? 90 : 30),
      contentForm: rand() < 0.35 ? 'video' : 'image',
      followers,
      readMedian,
      interactionMedian: Math.round(readMedian * (0.01 + rand() * 0.08)),
      likeMedian: Math.round(readMedian * 0.03),
      collectMedian: Math.round(readMedian * 0.02 * (0.5 + rand())),
      noteCount: Math.round(20 + rand() * 200),
      viralCount: Math.round(rand() * 10),
      priceImage: i % 7 === 0 ? null : Math.round(1_000 + rand() * 40_000),
      priceVideo: i % 5 === 0 ? null : Math.round(2_000 + rand() * 60_000),
      health: i % 11 === 0 ? 'abnormal' : 'healthy',
    })
    const json = JSON.stringify(metrics)
    const base = values.length
    // 3% of snapshots are older than 60 days: listed, not ranked.
    const fetchedDaysAgo = i % 33 === 0 ? 75 : Math.floor(rand() * 40)
    values.push(
      randomUUID(),
      `bench_${i}`,
      `压测博主 ${i}`,
      followers,
      ['서울', '上海', '부산'][i % 3],
      source,
      json,
      fetchedDaysAgo,
      metrics.window,
    )
    tuples.push(
      `($${base + 1},$${base + 2},$${base + 3},'released',false,$${base + 4},false,ARRAY[$${base + 5}],ARRAY['beauty'],` +
        `$${base + 7}::jsonb,$${base + 9},$${base + 6},$${base + 2},now() - make_interval(days => $${base + 8}::int),` +
        `$${base + 7}::jsonb,now(),now() - make_interval(days => $${base + 8}::int))`,
    )
  }
  await db.query(
    `INSERT INTO creators
       (id, creator_key, display_name, status, needs_review, followers, followers_unknown, regions, verticals,
        metrics, metrics_window, source, external_id, metrics_fetched_at, metrics_locked, metrics_locked_at,
        metrics_locked_fetched_at)
     VALUES ${tuples.join(',')}`,
    values,
  )
}
await db.query(
  `INSERT INTO creator_categories (creator_id, category_slug)
   SELECT id, CASE WHEN abs(hashtext(id)) % 4 = 0 THEN 'collaborated' ELSE 'never_collaborated' END
     FROM creators WHERE creator_key LIKE 'bench_%'
   ON CONFLICT DO NOTHING`,
)
// A quarter of them have worked with us, 1–4 times.
await db.query(
  `INSERT INTO collaborations (id, creator_id, brand, happened_at)
   SELECT c.id || ':' || n, c.id, 'bench-brand-' || n, current_date - n * 30
     FROM creators c, generate_series(1, 1 + abs(hashtext(c.id || 'n')) % 4) n
    WHERE c.creator_key LIKE 'bench_%' AND abs(hashtext(c.id)) % 4 = 0
   ON CONFLICT DO NOTHING`,
)
const loadMs = performance.now() - loadStarted

const refreshStarted = performance.now()
await ensurePublishedSnapshots(db, { full: true })
const refreshed = await refreshPublished(db, { full: true })
const refreshMs = performance.now() - refreshStarted
await db.query('ANALYZE')

const USERS: Record<string, { id: string; role: 'selector' | 'ops' }> = {
  selector: { id: 'user_selector', role: 'selector' },
  ops: { id: 'user_ops', role: 'ops' },
}
const app = createApp({
  db,
  store: new MemoryObjectStore(),
  now: () => new Date(),
  verifySession: async (token) => {
    const user = USERS[token] ?? USERS.selector
    return { id: user.id, orgId: 'org_platform', email: `${user.role}@kcs.local`, role: user.role, displayName: 'bench' }
  },
})
const headers = { authorization: 'Bearer selector', 'content-type': 'application/json' }
const opsHeaders = { authorization: 'Bearer ops', 'content-type': 'application/json' }
const pooled = await db.query('SELECT count(*)::int AS n, count(DISTINCT group_key)::int AS groups FROM creator_published')
const sample = await db.query("SELECT id FROM creators WHERE creator_key = 'bench_17'")
const lastPage = pageCount(pooled.rows[0].n, PAGE_SIZE_DEFAULT)
const middlePage = Math.max(1, Math.floor(lastPage / 2))

type Body = { items?: unknown[]; total?: number; nextCursor?: string | null }
const results: Array<{ label: string; median: number; p95: number; shape: string }> = []

async function time(label: string, run: () => Promise<Response>) {
  const samples: number[] = []
  let shape = ''
  for (let round = 0; round < rounds + 1; round += 1) {
    const started = performance.now()
    const res = await run()
    const body = await res.json() as Body
    const took = performance.now() - started
    if (res.status !== 200) throw new Error(`${label}: HTTP ${res.status} ${JSON.stringify(body)}`)
    if (round > 0) samples.push(took)
    shape = `${body.items?.length ?? '-'} / ${body.total ?? '-'}`
  }
  samples.sort((a, b) => a - b)
  results.push({
    label,
    median: samples[Math.floor(samples.length / 2)],
    p95: samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)],
    shape,
  })
}

const run = (spec: Partial<SavedQuery>, qs = '') => () =>
  app.request(`/api/select/queries/run${qs}`, { method: 'POST', headers, body: JSON.stringify(defaultSavedQuery({ name: 'bench', ...spec })) })
const get = (path: string) => () => app.request(path, { headers })
async function cursorAt(path: string): Promise<string> {
  const body = await (await app.request(path, { headers })).json() as Body
  if (!body.nextCursor) throw new Error(`no nextCursor for ${path}`)
  return body.nextCursor
}
async function runCursorAt(spec: Partial<SavedQuery>, page: number): Promise<string> {
  const body = await (await run(spec, `?page=${page}`)()).json() as Body
  if (!body.nextCursor) throw new Error(`no nextCursor at page ${page}`)
  return body.nextCursor
}

await time('pool: first page', get('/api/select/pool'))
await time('pool: first page, tier=mid, sort=readMedian', get('/api/select/pool?tier=mid&sort=readMedian'))
await time(`pool: jump to page ${middlePage} (offset)`, get(`/api/select/pool?page=${middlePage}`))
await time(`pool: jump to last page ${lastPage} (offset)`, get(`/api/select/pool?page=${lastPage}`))
const poolCursor = await cursorAt(`/api/select/pool?page=${middlePage}`)
await time(`pool: next from page ${middlePage} (cursor)`, get(`/api/select/pool?cursor=${encodeURIComponent(poolCursor)}`))
await time('queries/run: default plan, first page', run({}))
await time(`queries/run: jump to page ${middlePage} (offset)`, run({}, `?page=${middlePage}`))
const runCursor = await runCursorAt({}, middlePage)
await time(`queries/run: next from page ${middlePage} (cursor)`, run({}, `?cursor=${encodeURIComponent(runCursor)}`))
await time('queries/run: readMedian percentile ≥ 50', run({ filters: [{ key: 'readMedian', op: 'percentileGte', value: 50 }], sort: { key: 'readMedian', dir: 'desc' } }))
await time('queries/run: cpe ≥ 75 and engagement ≥ 50 (percentiles)', run({
  filters: [{ key: 'cpe', op: 'percentileGte', value: 75 }, { key: 'engagementRate', op: 'percentileGte', value: 50 }],
}))
const deepPercentile = { filters: [{ key: 'readMedian', op: 'percentileGte', value: 50 }] } satisfies Partial<SavedQuery>
const percentileTotal = ((await (await run(deepPercentile)()).json()) as Body).total ?? 0
const percentileLast = pageCount(percentileTotal, PAGE_SIZE_DEFAULT)
await time(`queries/run: percentile ≥ 50, jump to last page ${percentileLast}`, run(deepPercentile, `?page=${percentileLast}`))
await time('queries/run: "any of" + "leave out" groups, collaborated', run({
  hasCollaborated: true,
  groups: [
    { mode: 'any', filters: [{ key: 'cpe', op: 'lte', value: 2 }, { key: 'readMedian', op: 'percentileGte', value: 80 }] },
    { mode: 'exclude', filters: [{ key: 'engagementRate', op: 'lte', value: 0.02 }] },
  ],
}))
await time('queries/run: saved search "博主 12"', run({ search: '博主 12' }))
await time('GET /api/select/creators/:id', get(`/api/select/creators/${sample.rows[0].id}`))

const newId = randomUUID()
const createRes = await app.request('/api/ops/creators', {
  method: 'POST',
  headers: opsHeaders,
  body: JSON.stringify({
    displayName: '压测新博主', source: 'pugongying', externalId: `bench_new_${newId}`, regions: ['上海'], verticals: ['beauty'],
    metrics: { window: 30, contentForm: 'image', followers: 25_000, readMedian: 3_000, interactionMedian: 120, priceImage: 3_000 },
  }),
})
const created = await createRes.json() as { id: string }
const publishStarted = performance.now()
const publishRes = await app.request(`/api/ops/creators/${created.id}/publish`, { method: 'POST', headers: opsHeaders })
const publishMs = performance.now() - publishStarted
if (publishRes.status !== 200) throw new Error(`publish: HTTP ${publishRes.status}`)
const groupSize = await db.query(
  'SELECT count(*)::int AS n FROM creator_published WHERE group_key = (SELECT group_key FROM creator_published WHERE creator_id = $1)',
  [created.id],
)

console.log(`\n### ${pooled.rows[0].n} creators in the pool (${pooled.rows[0].groups} groups), ${rounds} rounds + 1 warm-up\n`)
console.log(`- load ${total} rows: ${(loadMs / 1000).toFixed(1)} s; full refresh (snapshots + pool table + all ranks): ${(refreshMs / 1000).toFixed(1)} s (${refreshed.written} rows written)`)
console.log(`- one publish (pool row + re-rank its group of ${groupSize.rows[0].n}): ${publishMs.toFixed(0)} ms\n`)
console.log('| request | median ms | p95 ms | rows / total |')
console.log('|---|---:|---:|---:|')
for (const r of results) console.log(`| ${r.label} | ${r.median.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.shape} |`)

await db.end()
