import { can, type Permission } from '@kcs/contract'

type KcsAppConfig = {
  key?: string
  perm?: Permission | null
}

/**
 * 四端各自独立部署：权限按「当前 app」判定，不再按路径前缀。
 * - marketing（perm: null）：全站公开。
 * - select/ops/dev：除登录页外都要求登录 + 本端权限。
 * 记住最近工作区（kcs_last_ws）仍受 cookie 同意门控。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()
  const kcs = useAppConfig().kcs as KcsAppConfig | undefined
  const perm = kcs?.perm ?? null
  if (!perm) return // 公开端（marketing）：不设门

  const publicPaths = ['/login', '/signin', '/denied']
  const bare = to.path.replace(/^\/(zh-CN|en|ko)/, '') || '/'
  const { user, refresh, token } = useSession()
  if (!user.value && token.value) await refresh()

  if (publicPaths.includes(bare)) return
  // Session cookie still present after refresh → signed in but no KCS role (API said 403);
  // an expired session would have cleared the cookie and belongs on /login.
  if (!user.value) return navigateTo(localePath(token.value ? '/denied' : '/login'))
  if (!can(user.value.role, perm)) return navigateTo(localePath('/denied'))

  // Remember the workspace for cross-app login handoff (preference cookie, consent-gated).
  if (import.meta.client && kcs?.key) {
    const { allowsPreferences } = useConsent()
    if (allowsPreferences.value) {
      const last = useCookie<string | null>('kcs_last_ws', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 })
      last.value = kcs.key
    }
  }
})
