import { serve } from '@hono/node-server'
import { createApp } from './app'
import { connectDb } from './db'
import { migrate } from './migrate'
import { createS3Store } from './s3'
import { seed } from './seed'
import { MemoryObjectStore } from './store'
import { startIngestWorker } from './ingest/worker'

const port = Number(process.env.PORT || 7100)

async function main() {
  if (process.env.KCS_DEV_TOKENS === '1' && process.env.NODE_ENV === 'production') {
    throw new Error('KCS_DEV_TOKENS cannot be enabled in production')
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required (Postgres)')
  const db = await connectDb(url)
  await migrate(db)
  await seed(db)
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
  const env = { db, store, now: () => new Date() }
  const app = createApp(env)
  startIngestWorker(env)
  serve({ fetch: app.fetch, port }, () => {
    console.log(`kcs-api listening on :${port}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
