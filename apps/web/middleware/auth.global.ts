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
})
