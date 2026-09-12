import { connectDb } from './db'
import { migrate } from './migrate'
import { createStoreFromEnv } from './s3'
import { seed } from './seed'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const db = await connectDb(url)
await migrate(db)
const store = createStoreFromEnv()
const counts = await seed(db, { reset: process.argv.includes('--reset'), store })
console.log('seeded', JSON.stringify(counts))
await db.end()
