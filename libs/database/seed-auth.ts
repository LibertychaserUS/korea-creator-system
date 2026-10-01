import { eq } from 'drizzle-orm'
import { SEED_PASSWORD, SEED_USERS } from '@kcs/contract'
import { auth } from '@libs/auth'
import { db, pool, user } from './index'

/**
 * `--stranger` (or KCS_SEED_STRANGER=1) also provisions an account that can sign
 * in to TinyShip but holds no KCS job — the only way to get one now that public
 * sign-up is closed. Used by the black-box "no role → 403 / denied" cases.
 */
const STRANGER = {
  email: process.env.KCS_SEED_STRANGER_EMAIL || 'stranger@kcs.local',
  name: '路人',
  role: 'user',
}

async function ensureUser(identity: { email: string; name: string; role: string }) {
  const existing = await db.query.user.findFirst({
    where: eq(user.email, identity.email),
  })
  if (!existing) {
    await auth.api.createUser({
      body: {
        email: identity.email,
        // 演示口令可用 KCS_DEMO_PASSWORD 覆盖，缺省回退内置常量。生产模式的
        // init（deploy/tools/init.ts）会删掉全部演示账号，所以这个回退值只会
        // 出现在开发/测试库，不会进入生产身份库。
        password: process.env.KCS_DEMO_PASSWORD || SEED_PASSWORD,
        name: identity.name,
        role: identity.role as 'user' | 'admin',
      },
    })
  }
  await db
    .update(user)
    .set({ name: identity.name, role: identity.role, updatedAt: new Date() })
    .where(eq(user.email, identity.email))
  console.log(`[auth-seed] ${identity.email} -> ${identity.role}`)
}

async function main() {
  for (const identity of SEED_USERS) {
    await ensureUser({ email: identity.email, name: identity.displayName, role: identity.role })
  }
  if (process.argv.includes('--stranger') || process.env.KCS_SEED_STRANGER === '1') {
    await ensureUser(STRANGER)
  }
}

main()
  .finally(async () => {
    if (pool?.end) await pool.end()
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
