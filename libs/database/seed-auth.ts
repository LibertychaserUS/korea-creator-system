import { eq } from 'drizzle-orm'
import { SEED_PASSWORD, SEED_USERS } from '@kcs/contract'
import { auth } from '@libs/auth'
import { db, pool, user } from './index'

async function main() {
  for (const identity of SEED_USERS) {
    const existing = await db.query.user.findFirst({
      where: eq(user.email, identity.email),
    })
    if (!existing) {
      await auth.api.createUser({
        body: {
          email: identity.email,
          password: SEED_PASSWORD,
          name: identity.displayName,
          role: identity.role,
        },
      })
    }
    await db
      .update(user)
      .set({ name: identity.displayName, role: identity.role, updatedAt: new Date() })
      .where(eq(user.email, identity.email))
    console.log(`[auth-seed] ${identity.email} -> ${identity.role}`)
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
