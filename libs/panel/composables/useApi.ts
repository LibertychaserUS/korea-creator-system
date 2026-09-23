type ApiOrigin = 'api' | 'self'

export function useApi() {
  const config = useRuntimeConfig()
  /**
   * `kcs_session` 是 TinyShip（better-auth）会话 token 的非 httpOnly 镜像，
   * 由本端 `/__login` 写入；API 只拿它去 TinyShip 校验并换回 KCS 角色。
   */
  const token = useCookie<string | null>('kcs_session', { sameSite: 'lax', path: '/' })
  const localePath = useLocalePath()

  /**
   * `origin: 'self'` 打本端源站（账号管理 `/api/kcs-admin/**` 就在 TinyShip 这边），
   * 默认打 Hono API。
   */
  async function send(path: string, opts: RequestInit = {}, origin: ApiOrigin = 'api'): Promise<Response> {
    const headers = new Headers(opts.headers)
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
    if (!isForm && !headers.has('content-type')) headers.set('content-type', 'application/json')
    if (token.value) headers.set('authorization', `Bearer ${token.value}`)
    const res = await fetch(`${origin === 'self' ? '' : config.public.apiBase}${path}`, {
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
    return res
  }

  async function request<T>(path: string, opts: RequestInit = {}, origin: ApiOrigin = 'api'): Promise<T> {
    const res = await send(path, opts, origin)
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) {
      // Hono: `{ error: { message } }` / `{ error }`；Nitro createError: `{ error: true, data: { error } }`
      const message = typeof data.data?.error === 'string'
        ? data.data.error
        : data.error?.message || (typeof data.error === 'string' ? data.error : '') || 'request_failed'
      throw Object.assign(new Error(message), { status: res.status, data })
    }
    return data as T
  }

  /** 拿文件（导出表格等）：同样带会话，存成浏览器下载。 */
  async function download(path: string, filename: string): Promise<void> {
    const res = await send(path)
    if (!res.ok) throw Object.assign(new Error('request_failed'), { status: res.status })
    const url = URL.createObjectURL(await res.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return { request, download, token }
}
