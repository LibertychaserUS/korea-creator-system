import { createApp, type AppEnv } from '../src/app'
import { SEED_PASSWORD, SEED_USERS } from '@kcs/contract'
import { connectDb } from '../src/db'
import { migrate } from '../src/migrate'
import { seed } from '../src/seed'
import { MemoryObjectStore } from '../src/store'
import type { SourceAdapter } from '@kcs/contract'
import type { Db } from '../src/db'

export type TestCtx = {
  app: ReturnType<typeof createApp>
  env: AppEnv
  db: Db
  close: () => Promise<void>
  login: (email: string, password?: string) => Promise<Response>
  loginJson: (email: string, password?: string) => Promise<{ token: string; user: { role: string } }>
}

const DEFAULT_URL = 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test'

export async function createTestApp(options: {
  getAdapter?: (source: string) => SourceAdapter | undefined
} = {}): Promise<TestCtx> {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_URL
  const db = await connectDb(url)
  await migrate(db)
  await seed(db, { reset: true })
  const store = new MemoryObjectStore()
  const usersByToken = new Map(
    SEED_USERS.map((user) => [
      `test:${user.email}`,
      {
        id: `user_${user.role}`,
        orgId: 'org_platform',
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
    ]),
  )
  const env: AppEnv = {
    db,
    store,
    now: () => new Date(),
    verifySession: async (token) => usersByToken.get(token) ?? null,
    getAdapter: options.getAdapter,
  }
  const app = createApp(env)

  return {
    app,
    env,
    db,
    close: async () => {
      await db.end()
    },
    login: async (email, password = SEED_PASSWORD) => {
      const user = SEED_USERS.find((candidate) => candidate.email === email)
      if (!user || password !== SEED_PASSWORD) {
        return Response.json(
          { error: { code: 'AUTH-LOGIN', message: 'invalid_credentials' } },
          { status: 401 },
        )
      }
      return Response.json({
        token: `test:${email}`,
        user: { id: `user_${user.role}`, email, role: user.role, displayName: user.displayName },
      })
    },
    loginJson: async (email, password = SEED_PASSWORD) => {
      const response = await (async () => {
        const user = SEED_USERS.find((candidate) => candidate.email === email)
        if (!user || password !== SEED_PASSWORD) throw new Error(`unknown test identity: ${email}`)
        return {
          token: `test:${email}`,
          user: { role: user.role },
        }
      })()
      return response
    },
  }
}
