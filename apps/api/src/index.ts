import { serve } from '@hono/node-server'
import { createApp } from './app'
import { connectDb } from './db'
import { migrate } from './migrate'
import { createS3Store } from './s3'
import { seed } from './seed'
import { MemoryObjectStore } from './store'
import { startIngestWorker } from './ingest/worker'
import { ensurePublishedSnapshots } from './http/pool'
import { errorMessage, logEvent } from './log'
import { createShutdown, SHUTDOWN_TIMEOUT_MS } from './shutdown'

const port = Number(process.env.PORT || 7100)

async function main() {
  if (process.env.KCS_DEV_TOKENS === '1' && process.env.NODE_ENV === 'production') {
    throw new Error('KCS_DEV_TOKENS cannot be enabled in production')
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required (Postgres)')
  const db = await connectDb(url)
  await migrate(db)
  // Demo creators / projects / jobs are opt-in: a real install must never get them.
  if (process.env.KCS_SEED === 'demo') {
    const counts = await seed(db)
    logEvent('info', 'seed.demo_loaded', counts)
  }
  await ensurePublishedSnapshots(db, { full: true })
  const store =
    process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY
      ? createS3Store({
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION || 'us-east-1',
          bucket: process.env.S3_BUCKET || 'kcs-assets',
          accessKey: process.env.S3_ACCESS_KEY,
          secretKey: process.env.S3_SECRET_KEY || '',
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        })
      : new MemoryObjectStore()
  const lifecycle = { draining: false }
  const env = { db, store, now: () => new Date(), lifecycle }
  const app = createApp(env)
  const stopWorker = startIngestWorker(env)
  const server = serve({ fetch: app.fetch, port }, () => {
    logEvent('info', 'api.listening', { port })
  })
  const timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS) || SHUTDOWN_TIMEOUT_MS
  const shutdown = createShutdown({ server, stopWorker, db, lifecycle, timeoutMs, exit: process.exit })
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => void shutdown(signal))
}

main().catch((err) => {
  logEvent('error', 'api.start_failed', { message: errorMessage(err) })
  process.exit(1)
})
