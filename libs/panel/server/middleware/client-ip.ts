// better-auth keys its sign-in throttle on `x-forwarded-for` and, under
// NODE_ENV=production, skips the limiter entirely when that header is missing.
// Without a proxy in front, fall back to the socket address so the throttle holds.
export default defineEventHandler((event) => {
  const headers = event.node.req.headers
  if (headers['x-forwarded-for']) return
  const address = event.node.req.socket?.remoteAddress
  if (!address) return
  headers['x-forwarded-for'] = address.replace(/^::ffff:/, '')
})
