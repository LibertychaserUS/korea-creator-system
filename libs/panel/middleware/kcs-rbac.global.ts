import { can, type Permission } from '@kcs/contract'

type KcsAppConfig = {
  key?: string
  perm?: Permission | null
  nav?: { to: string; perm?: Permission }[]
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
  const { user, refresh, hasSession } = useSession()
  if (!user.value && hasSession.value) await refresh()

  if (publicPaths.includes(bare)) return
  // Session cookie still present after refresh → signed in but no KCS role (API said 403);
  // an expired session would have cleared the cookie and belongs on /login.
  if (!user.value) return navigateTo(localePath(hasSession.value ? '/denied' : '/login'))
  if (!can(user.value.role, perm)) return navigateTo(localePath('/denied'))
  // 侧栏条目自带的权限（如 /accounts 要 admin.users）同样按路径把门，不能靠藏按钮。
  const guarded = kcs?.nav?.find((item) => item.perm && item.to !== '/' && (bare === item.to || bare.startsWith(`${item.to}/`)))
  if (guarded?.perm && !can(user.value.role, guarded.perm)) return navigateTo(localePath('/denied'))

  // Remember the workspace for cross-app login handoff (preference cookie, consent-gated).
  if (import.meta.client && kcs?.key) {
    const { allowsPreferences } = useConsent()
    if (allowsPreferences.value) {
      // Read by the marketing origin's /__login, so it lives on the shared parent domain.
      const domain = (useRuntimeConfig().public.cookieDomain as string) || undefined
      const last = useCookie<string | null>('kcs_last_ws', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180, domain })
      last.value = kcs.key
    }
  }
})
