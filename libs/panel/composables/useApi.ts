import { isPermissionDenial } from '@kcs/contract'

type ApiOrigin = 'api' | 'self'

export function useApi() {
  const config = useRuntimeConfig()
  /**
   * `kcs_session`（TinyShip / better-auth 会话 token）是 httpOnly cookie，由本端
   * `/__login` 写入，页面脚本读不到：浏览器请求 API 时带 `credentials: 'include'`
   * 自动附上；服务端渲染时这里读请求里的 cookie，改成 `Authorization: Bearer` 转给 API。
   */
  const serverToken = import.meta.server ? useCookie<string | null>('kcs_session', { readonly: true }) : null
  /** 这个请求有没有带会话 cookie；服务端渲染时定下来，随 payload 带到浏览器。 */
  const hasSession = useState<boolean>('kcs-has-session', () => Boolean(serverToken?.value))
  const localePath = useLocalePath()
  // useSession 在路由中间件里调这里，useI18n() 只能在组件 setup 顶层用
  const { t, te } = useNuxtApp().$i18n

  /**
   * `origin: 'self'` 打本端源站（账号管理 `/api/kcs-admin/**` 就在 TinyShip 这边），
   * 默认打 Hono API。
   */
  async function send(path: string, opts: RequestInit = {}, origin: ApiOrigin = 'api'): Promise<Response> {
    const headers = new Headers(opts.headers)
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
    if (!isForm && !headers.has('content-type')) headers.set('content-type', 'application/json')
    if (serverToken?.value) headers.set('authorization', `Bearer ${serverToken.value}`)
    const apiBase = (import.meta.server && config.apiInternalBase) || config.public.apiBase
    const res = await fetch(`${origin === 'self' ? '' : apiBase}${path}`, {
      ...opts,
      headers,
      credentials: 'include',
    })
    if (res.status === 401) {
      hasSession.value = false
      await navigateTo(localePath('/login'))
      throw new Error('unauthenticated')
    }
    // 只有「这个账号不能来这里」才跳走；「这件事你不能做」（如只有作者能改可见范围）留在原页，由调用方就地提示。
    if (res.status === 403) {
      const body = await res.clone().json().catch(() => null)
      if (isPermissionDenial(body)) {
        await navigateTo(localePath('/denied'))
        throw new Error('forbidden')
      }
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

  /** 接口报错的人话：已知错误码有对应文案就用文案，否则原样。 */
  function errorText(error: unknown): string {
    const message = String((error as { message?: unknown })?.message ?? error ?? '')
    const key = `kcs.apiError.${message}`
    return te(key) ? t(key) : message
  }

  return { request, download, hasSession, errorText }
}
