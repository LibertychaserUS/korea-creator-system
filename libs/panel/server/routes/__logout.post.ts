import { auth } from '@libs/auth'

export default defineEventHandler(async (event) => {
  let ok = false
  try {
    const response = await auth.api.signOut({
      headers: new Headers(
        Object.entries(getRequestHeaders(event))
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      ),
      asResponse: true,
    })
    ok = response.ok
    for (const cookie of response.headers.getSetCookie()) {
      appendResponseHeader(event, 'set-cookie', cookie)
    }
  } catch {
    // Already signed out (or the session is gone): still clear the local mirror.
  }
  deleteCookie(event, 'kcs_session', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  return { ok }
})
