import { can } from '@kcs/contract'

export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()
  const publicPaths = ['/', '/login', '/signin']
  const bare = to.path.replace(/^\/(zh-CN|en|ko)/, '') || '/'
  const { user, refresh, token } = useSession()
  if (!user.value && token.value) await refresh()

  if (publicPaths.includes(bare)) return
  if (!user.value) return navigateTo(localePath('/login'))
  if (bare === '/denied') return

  const workspace = bare.startsWith('/ops')
    ? 'ops.read'
    : bare.startsWith('/dev')
      ? 'dev.read'
      : bare.startsWith('/ingest')
        ? 'ingest.read'
        : bare.startsWith('/select')
          ? 'select.read'
          : null
  if (workspace && !can(user.value.role, workspace)) return navigateTo(localePath('/denied'))

  // Remember last workspace for multi-workspace roles (preference cookie, consent-gated).
  if (workspace && import.meta.client) {
    const { allowsPreferences } = useConsent()
    if (allowsPreferences.value) {
      const ws = bare.startsWith('/ops') ? 'ops' : bare.startsWith('/dev') ? 'dev' : bare.startsWith('/select') ? 'select' : null
      if (ws) {
        const last = useCookie<string | null>('kcs_last_ws', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 })
        last.value = ws
      }
    }
  }
})
