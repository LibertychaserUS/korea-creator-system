import { auth } from '@libs/auth'
import { isSameOriginRequest } from '../utils/same-origin'

export default defineEventHandler(async (event) => {
  // M-1: logout mutates the session state — refuse cross-origin triggers.
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'origin_not_allowed' })
  }
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
  expireHostOnlySession(event)
  deleteCookie(event, SESSION_COOKIE, sessionCookieOptions())
  return { ok }
})
