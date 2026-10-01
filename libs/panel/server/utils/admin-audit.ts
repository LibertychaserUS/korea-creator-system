import type { H3Event } from 'h3'

/**
 * 账号管理审计转发。创建/修改账号发生在工作端源站（TinyShip / Nitro 侧），
 * 成功操作后把记录汇报给 Hono API 的 audit_logs（控制台「操作记录」页）。
 *
 * 身份用请求的 `kcs_session` cookie 原样转发（httpOnly，这里拿不到值，
 * 只能透传 cookie 头），API 侧按同一规则解析会话。地址取 runtime config
 * 的 public.apiBase（NUXT_PUBLIC_API_BASE），与 useApi 的服务端用法一致。
 *
 * 审计失败只 console.warn：主流程（建号/改角色）已经成功了，绝不能因为
 * 审计服务不可用而把错误抛给用户。
 */
export async function reportAccountAudit(
  event: H3Event,
  entry: { action: 'account.create' | 'account.update'; target: string; summary: string },
): Promise<void> {
  try {
    const base = String(useRuntimeConfig(event).public.apiBase || '').replace(/\/+$/, '')
    if (!base) return
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const cookie = getHeader(event, 'cookie')
    if (cookie) headers.cookie = cookie
    const response = await fetch(`${base}/api/auth/admin-audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) {
      console.warn('[admin-audit] audit endpoint returned', response.status, entry.action, entry.target)
    }
  } catch (error) {
    console.warn('[admin-audit] failed to report', entry.action, entry.target, error)
  }
}
