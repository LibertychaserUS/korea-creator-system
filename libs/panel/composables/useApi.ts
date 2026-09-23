export function useApi() {
  const config = useRuntimeConfig()
  /**
   * `kcs_session` 是 TinyShip（better-auth）会话 token 的非 httpOnly 镜像，
   * 由本端 `/__login` 写入；API 只拿它去 TinyShip 校验并换回 KCS 角色。
   */
  const token = useCookie<string | null>('kcs_session', { sameSite: 'lax', path: '/' })
  const localePath = useLocalePath()

  async function send(path: string, opts: RequestInit = {}): Promise<Response> {
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
    return res
  }

  async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await send(path, opts)
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) throw Object.assign(new Error(data.error?.message || data.error || 'request_failed'), { status: res.status, data })
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
