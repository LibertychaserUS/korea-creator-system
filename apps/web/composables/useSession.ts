import type { Role } from '@kcs/contract'

export type SessionUser = {
  id: string
  email: string
  role: Role
  displayName: string
}

export function useSession() {
  const user = useState<SessionUser | null>('kcs-user', () => null)
  const { request, token } = useApi()

  async function refresh() {
    if (!token.value) {
      user.value = null
      return null
    }
    try {
      const data = await request<{ user: SessionUser }>('/api/auth/me')
      user.value = data.user
      return data.user
    } catch {
      user.value = null
      return null
    }
  }

  return { user, refresh, token }
}
