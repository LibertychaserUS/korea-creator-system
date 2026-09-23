export function jsonError(
  context: { json: (body: unknown, status?: number) => Response },
  status: number,
  code: string,
  message = code,
) {
  return context.json({ error: { code, message } }, status)
}
