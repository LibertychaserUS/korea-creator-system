import { API, type Role } from '@kcs/contract'

export type SessionUser = {
  id: string
  email: string
  role: Role
  displayName: string
  orgId?: string
}

export function useSession() {
  const user = useState<SessionUser | null>('kcs-user', () => null)
  const { request, hasSession } = useApi()

  async function refresh() {
    if (!hasSession.value) {
      user.value = null
      return null
    }
    try {
      const data = await request<{ user: SessionUser }>(API.me.path)
      user.value = data.user
      return data.user
    } catch {
      user.value = null
      return null
    }
  }

  /** 退出后本地的会话状态；cookie 由 `/__logout` 在服务端清掉。 */
  function clear() {
    hasSession.value = false
    user.value = null
  }

  return { user, refresh, hasSession, clear }
}
