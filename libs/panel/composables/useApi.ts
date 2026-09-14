export function useApi() {
  const config = useRuntimeConfig()
  /**
   * `kcs_session` 是 TinyShip（better-auth）会话 token 的非 httpOnly 镜像，
   * 由本端 `/__login` 写入；API 只拿它去 TinyShip 校验并换回 KCS 角色。
   */
  const token = useCookie<string | null>('kcs_session', { sameSite: 'lax', path: '/' })
  const localePath = useLocalePath()

  async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const headers = new Headers(opts.headers)
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
    if (!isForm && !headers.has('content-type')) headers.set('content-type', 'application/json')
    if (token.value) headers.set('authorization', `Bearer ${token.value}`)
    const res = await fetch(`${config.public.apiBase}${path}`, {
      ...opts,
      headers,
      credentials: 'include',
    })
    if (res.status === 401) {
      token.value = null
      await navigateTo(localePath('/login'))
      throw new Error('unauthenticated')
    }
    if (res.status === 403) {
      await navigateTo(localePath('/denied'))
      throw new Error('forbidden')
    }
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) throw Object.assign(new Error(data.error?.message || data.error || 'request_failed'), { status: res.status, data })
    return data as T
  }

  return { request, token }
}
