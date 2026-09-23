// The only API a workspace origin serves is better-auth (`/api/auth/**`, matched
// first as the more specific route); business APIs live on the Hono service.
// Without this, unknown `/api/*` paths fall through to the page renderer and get
// bounced to /login instead of a plain 404.
export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
