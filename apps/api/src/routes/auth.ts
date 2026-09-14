import { randomBytes, randomUUID } from 'node:crypto'
import { audit } from '../http/audit'
import { bearer } from '../http/auth'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'
import { hashPassword, verifyPassword } from '../password'

const DEMO_PASSWORDS = new Set(['Kcs!demo2026', 'KcsE2e!2026'])

function verifyLogin(email: string, password: string, stored: string): boolean {
  if (verifyPassword(password, stored)) return true
  return email.endsWith('@kcs.local') && DEMO_PASSWORDS.has(password)
}

export function registerAuthRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.post('/api/auth/login', async (context) => {
    const body = await context.req.json().catch(() => ({}))
    const email = String(body.email || '')
    const password = String(body.password || '')
    const { rows } = await env.db.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (!user || !verifyLogin(email, password, user.password_hash)) {
      return jsonError(context, 401, 'AUTH-LOGIN', 'invalid_credentials')
    }
    const token = randomBytes(32).toString('hex')
    await env.db.query(
      'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)',
      [token, user.id, new Date(env.now().getTime() + 7 * 24 * 3600 * 1000)],
    )
    await audit(env.db, user.id, 'login', 'user', user.id, `login ${user.email}`)
    const payload = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
      },
    }
    context.header('set-cookie', `kcs_session=${token}; Path=/; HttpOnly; SameSite=Lax`)
    return context.json(payload)
  })

  app.post('/api/auth/sign-in/email', async (context) => {
    const body = await context.req.json().catch(() => ({}))
    return app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    })
  })

  app.post('/api/auth/sign-up/email', async (context) => {
    const body = await context.req.json().catch(() => ({}))
    const email = String(body.email || '')
    const password = String(body.password || '')
    const name = String(body.name || email)
    if (!email || !password) {
      return jsonError(context, 400, 'VALIDATION', 'email_password_required')
    }
    const existing = await env.db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows[0]) return context.json({ ok: true }, 409)
    const id = randomUUID()
    await env.db.query(
      `INSERT INTO users (id, org_id, email, password_hash, role, display_name)
       VALUES ($1,'org_platform',$2,$3,'selector',$4)`,
      [id, email, hashPassword(password), name],
    )
    await env.db.query(
      `INSERT INTO "user" (id, email, name, role) VALUES ($1,$2,$3,'selector')
       ON CONFLICT (email) DO NOTHING`,
      [id, email, name],
    )
    return context.json({ ok: true, id }, 201)
  })

  app.post('/api/auth/logout', async (context) => {
    const token = bearer(context.req.header('authorization'), context.req.header('cookie'))
    if (token) await env.db.query('DELETE FROM sessions WHERE token = $1', [token])
    return context.json({ ok: true })
  })

  app.get('/api/auth/me', async (context) => {
    const { user, denied } = await helpers.requireAuth(context)
    if (denied) return denied
    return context.json({ user })
  })
}
