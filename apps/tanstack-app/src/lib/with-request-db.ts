import { withRequestClient, withD1, getDialect } from '@libs/database'

async function getD1Binding(): Promise<any> {
  const { env } = await import('cloudflare:workers')
  const binding = (env as any).DB
  if (!binding) {
    throw new Error('D1 binding "DB" not found. Check wrangler.jsonc d1_databases config.')
  }
  return binding
}

/**
 * Wraps a TanStack API route handler so that all DB operations
 * within a single HTTP request share one connection.
 *
 * - pg / sqlite: uses withRequestClient (PG pool or no-op passthrough)
 * - d1: injects the D1 binding from Cloudflare Workers env
 */
export function withCfDb<T extends { request: Request }>(
  handler: (ctx: T) => Promise<Response>,
): (ctx: T) => Promise<Response> {
  if (getDialect() === 'd1') {
    return async (ctx: T) => {
      const d1Binding = await getD1Binding()
      return withD1!(d1Binding, () => handler(ctx))
    }
  }
  return (ctx: T) => withRequestClient(() => handler(ctx))
}

/**
 * Wraps an async function with the appropriate DB context for
 * createServerFn handlers.
 *
 * - pg / sqlite: uses withRequestClient (PG pool or no-op passthrough)
 * - d1: extracts D1 binding from Cloudflare Workers env
 */
export async function withDbContext<T>(fn: () => Promise<T>): Promise<T> {
  if (getDialect() === 'd1') {
    const d1Binding = await getD1Binding()
    return withD1!(d1Binding, fn)
  }
  return withRequestClient(fn)
}
