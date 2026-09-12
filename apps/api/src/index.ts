import { serve } from '@hono/node-server'
import { createApp } from './app'
import { connectDb } from './db'
import { migrate } from './migrate'
import { createStoreFromEnv } from './s3'
import { seed } from './seed'

const port = Number(process.env.PORT || 7100)

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required (Postgres)')
  const db = await connectDb(url)
  await migrate(db)
  const store = createStoreFromEnv()
  await seed(db, { store })
  const app = createApp({ db, store, now: () => new Date() })
  serve({ fetch: app.fetch, port }, () => {
    console.log(`kcs-api listening on :${port}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
