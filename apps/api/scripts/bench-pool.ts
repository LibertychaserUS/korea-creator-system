/**
 * Pool latency with a realistic number of published creators.
 *
 *   BENCH_DATABASE_URL=postgres://kcs:kcs@127.0.0.1:5432/kcs_rf_test \
 *     pnpm --filter @kcs/api exec tsx scripts/bench-pool.ts
 *
 * Resets the target database (seed reset + BENCH_CREATORS extra released
 * creators, default 5000), then times the select-side read paths. Never point
 * it at a database whose data you want to keep.
 */
import { randomUUID } from 'node:crypto'
import { deriveMetrics, emptyMetrics, SOURCE_IDS } from '@kcs/contract'
import { createApp } from '../src/app'
import { connectDb } from '../src/db'
import { migrate } from '../src/migrate'
import { seed } from '../src/seed'
import { MemoryObjectStore } from '../src/store'

const url = process.env.BENCH_DATABASE_URL
if (!url) throw new Error('BENCH_DATABASE_URL is required (the database is reset)')
const total = Number(process.env.BENCH_CREATORS || 5000)
const rounds = Number(process.env.BENCH_ROUNDS || 5)

const db = await connectDb(url)
await migrate(db)
await seed(db, { reset: true })
await db.query("DELETE FROM creators WHERE creator_key LIKE 'bench_%'")

let seedValue = 42
function rand() {
  seedValue = (seedValue * 1_103_515_245 + 12_345) % 2 ** 31
  return seedValue / 2 ** 31
}

const BATCH = 500
for (let offset = 0; offset < total; offset += BATCH) {
  const values: unknown[] = []
  const tuples: string[] = []
  for (let i = offset; i < Math.min(total, offset + BATCH); i += 1) {
    const followers = Math.round(300 + rand() * 900_000)
    const readMedian = Math.round(followers * (0.02 + rand() * 0.2))
    const metrics = deriveMetrics({
      ...emptyMetrics(30),
      followers,
      readMedian,
      interactionMedian: Math.round(readMedian * (0.01 + rand() * 0.08)),
      likeMedian: Math.round(readMedian * 0.03),
      collectMedian: Math.round(readMedian * 0.02 * (0.5 + rand())),
      noteCount: Math.round(20 + rand() * 200),
      viralCount: Math.round(rand() * 10),
      priceImage: i % 7 === 0 ? null : Math.round(1_000 + rand() * 40_000),
      health: (['excellent', 'normal', 'abnormal'] as const)[i % 3],
    })
    const json = JSON.stringify(metrics)
    const base = values.length
    values.push(
      randomUUID(),
      `bench_${i}`,
      `压测博主 ${i}`,
      followers,
      ['서울', '上海', '부산'][i % 3],
      SOURCE_IDS[i % SOURCE_IDS.length],
      json,
    )
    tuples.push(
      `($${base + 1},$${base + 2},$${base + 3},'released',false,$${base + 4},false,ARRAY[$${base + 5}],ARRAY['beauty'],` +
        `$${base + 7}::jsonb,30,$${base + 6},$${base + 2},now(),$${base + 7}::jsonb,now())`,
    )
  }
  await db.query(
    `INSERT INTO creators
       (id, creator_key, display_name, status, needs_review, followers, followers_unknown, regions, verticals,
        metrics, metrics_window, source, external_id, metrics_fetched_at, metrics_locked, metrics_locked_at)
     VALUES ${tuples.join(',')}`,
    values,
  )
}
await db.query(
  `INSERT INTO creator_categories (creator_id, category_slug)
   SELECT id, 'never_collaborated' FROM creators WHERE creator_key LIKE 'bench_%'
   ON CONFLICT DO NOTHING`,
)
await db.query('ANALYZE')

const app = createApp({
  db,
  store: new MemoryObjectStore(),
  now: () => new Date(),
  verifySession: async () => ({
    id: 'user_selector',
    orgId: 'org_platform',
    email: 'selector@kcs.local',
    role: 'selector',
    displayName: 'bench',
  }),
})
const headers = { authorization: 'Bearer bench', 'content-type': 'application/json' }
const released = await db.query("SELECT count(*)::int AS n FROM creators WHERE status = 'released'")
const sample = await db.query("SELECT id FROM creators WHERE creator_key = 'bench_17'")

async function time(label: string, run: () => Promise<Response>) {
  const samples: number[] = []
  let shape = ''
  for (let round = 0; round < rounds + 1; round += 1) {
    const started = performance.now()
    const res = await run()
    const body = await res.json() as { items?: unknown[]; total?: number }
    const took = performance.now() - started
    if (res.status !== 200) throw new Error(`${label}: HTTP ${res.status}`)
    if (round > 0) samples.push(took)
    shape = `items=${body.items?.length ?? '-'} total=${body.total ?? '-'}`
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]
  console.log(`${label.padEnd(44)} median ${median.toFixed(1).padStart(8)} ms   (${shape})`)
}

console.log(`released creators: ${released.rows[0].n}, rounds: ${rounds} (+1 warm-up)`)
await time('GET /api/select/pool', () => app.request('/api/select/pool', { headers }))
await time('GET /api/select/pool?pageSize=50', () => app.request('/api/select/pool?pageSize=50', { headers }))
await time('GET /api/select/pool?tier=mid&sort=cpe', () =>
  app.request('/api/select/pool?tier=mid&sort=cpe', { headers }))
await time('POST /api/select/queries/run (default)', () =>
  app.request('/api/select/queries/run', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'bench', filters: [], sort: { key: 'cpe', dir: 'asc' }, columns: ['followers', 'cpe'], highlights: [], sources: [], tiers: [], health: [], regions: [], brandsAny: [] }),
  }))
await time('POST /api/select/queries/run (percentileGte)', () =>
  app.request('/api/select/queries/run', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'bench', filters: [{ key: 'readMedian', op: 'percentileGte', value: 50 }], sort: { key: 'readMedian', dir: 'desc' }, columns: ['followers', 'readMedian', 'cpe'], highlights: [], sources: [], tiers: [], health: [], regions: [], brandsAny: [] }),
  }))
await time('GET /api/select/pool?page=90 (deep page)', () => app.request('/api/select/pool?page=90', { headers }))
await time('GET /api/select/creators/:id', () =>
  app.request(`/api/select/creators/${sample.rows[0].id}`, { headers }))

await db.end()
