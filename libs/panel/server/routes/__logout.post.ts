import { auth } from '@libs/auth'

export default defineEventHandler(async (event) => {
  const response = await auth.api.signOut({
    headers: new Headers(
      Object.entries(getRequestHeaders(event))
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    asResponse: true,
  })
  for (const cookie of response.headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }
  deleteCookie(event, 'kcs_session', { path: '/' })
  return { ok: response.ok }
})
