import { connectDb } from './db'
import { migrate } from './migrate'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const db = await connectDb(url)
await migrate(db)
console.log('migrated')
await db.end()
