import { APIError, createAuthMiddleware } from 'better-auth/api'
import type { BetterAuthPlugin } from 'better-auth'
import type { ZodType } from 'zod'

/**
 * Validate request bodies for chosen auth endpoints with zod schemas.
 *
 * Replaces `validation-better-auth`, which wrapped every schema failure in an
 * INTERNAL_SERVER_ERROR — so a malformed email on sign-in answered 500. A bad
 * body is the caller's fault and must be a 400 with the field issues attached.
 */
export function validateBody(rules: Array<{ path: string; schema: ZodType }>): BetterAuthPlugin {
  return {
    id: 'kcs-validate-body',
    middlewares: rules.map(({ path, schema }) => ({
      path,
      middleware: createAuthMiddleware(async (ctx) => {
        const result = await schema.safeParseAsync(ctx.body)
        if (!result.success) {
          throw new APIError('BAD_REQUEST', {
            code: 'INVALID_FIELDS',
            message: 'Invalid fields',
            issues: result.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              code: issue.code,
              message: issue.message,
            })),
          })
        }
        ctx.body = result.data
      }),
    })),
  }
}
