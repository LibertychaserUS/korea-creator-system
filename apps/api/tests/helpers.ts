import { createApp, type AppEnv } from '../src/app'
import { connectDb } from '../src/db'
import { migrate } from '../src/migrate'
import { seed } from '../src/seed'
import { MemoryObjectStore } from '../src/store'

export type TestCtx = {
  app: ReturnType<typeof createApp>
  close: () => Promise<void>
  login: (email: string, password?: string) => Promise<Response>
  loginJson: (email: string, password?: string) => Promise<{ token: string; user: { role: string } }>
}

const DEFAULT_URL = 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test'

export async function createTestApp(): Promise<TestCtx> {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_URL
  const db = await connectDb(url)
  await migrate(db)
  await seed(db, { reset: true })
  const store = new MemoryObjectStore()
  const env: AppEnv = { db, store, now: () => new Date() }
  const app = createApp(env)

  return {
    app,
    close: async () => {
      await db.end()
    },
    login: (email, password = 'Kcs!demo2026') =>
      Promise.resolve(app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })),
    loginJson: async (email, password = 'Kcs!demo2026') => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      return res.json()
    },
  }
}
