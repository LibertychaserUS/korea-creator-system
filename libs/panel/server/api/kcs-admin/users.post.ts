import { eq } from 'drizzle-orm'
import { auth } from '@libs/auth'
import { db, user } from '@libs/database'
import { accountError, MIN_PASSWORD_LENGTH, parseRole, requireAccountAdmin } from '../../utils/kcs-admin'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  await requireAccountAdmin(event)
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  const name = String(body?.name ?? '').trim() || email.split('@')[0]
  const role = parseRole(body?.role)
  if (!EMAIL.test(email)) accountError(400, 'invalid_email')
  if (password.length < MIN_PASSWORD_LENGTH) accountError(400, 'weak_password')
  if (!role) accountError(400, 'invalid_role')

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (existing.length) accountError(409, 'email_taken')

  let created: { user: { id: string } }
  try {
    // better-auth's admin plugin only types its stock roles; the KCS role is written right after.
    created = await auth.api.createUser({ body: { email, password, name, role: 'user' } }) as { user: { id: string } }
  } catch {
    accountError(409, 'email_taken')
  }
  await db
    .update(user)
    .set({ role, emailVerified: true, updatedAt: new Date() })
    .where(eq(user.id, created.user.id))
  setResponseStatus(event, 201)
  return { id: created.user.id, email, name, role, disabled: false }
})
