import { connectDb } from './db'
import { runBasisBacktest } from './ingest/basis-backtest'

/** `DATABASE_URL=… pnpm --filter @kcs/api backtest:basis`: prints the 口径 backtest as JSON. Reads only. */
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const db = await connectDb(url)
try {
  console.log(JSON.stringify(await runBasisBacktest(db, process.argv[2] || 'pugongying'), null, 2))
} finally {
  await db.end()
}
