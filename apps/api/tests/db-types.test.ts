import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectDb, type Db } from '../src/db'

let db: Db

beforeAll(async () => {
  db = await connectDb(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test')
})

afterAll(async () => {
  await db.end()
})

describe('date columns', () => {
  it('come back as the calendar day, whatever the process time zone', async () => {
    const { rows } = await db.query("SELECT '2026-09-23'::date AS day, NULL::date AS none")
    expect(rows[0].day).toBe('2026-09-23')
    expect(rows[0].none).toBeNull()
  })
})
