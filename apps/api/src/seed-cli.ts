import { connectDb } from './db'
import { migrate } from './migrate'
import { seed } from './seed'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const db = await connectDb(url)
await migrate(db)
await seed(db, { reset: process.argv.includes('--reset') })
console.log('seeded')
await db.end()
