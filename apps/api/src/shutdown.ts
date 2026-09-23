import { errorMessage, logEvent } from './log'

export type ShutdownDeps = {
  server: { close: (callback: (error?: Error) => void) => unknown }
  stopWorker: () => Promise<void>
  db: { end: () => Promise<void> }
  lifecycle: { draining: boolean }
  timeoutMs: number
  exit: (code: number) => void
}

export const SHUTDOWN_TIMEOUT_MS = 25_000

/** Resolves true if `work` settled in time, false if the deadline hit first. */
async function within(work: Promise<unknown>, ms: number) {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms)
  })
  try {
    return await Promise.race([work.then(() => true as const, () => true as const), deadline])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * SIGTERM / SIGINT: stop accepting requests, let the drainer hand its job back
 * at the next page boundary and release the queue lock, wait for in-flight
 * requests, close the pool, exit. The whole wait is capped by `timeoutMs`
 * (keep it under the orchestrator's grace period); past it the process exits
 * anyway and the job's lease lapses so another process picks it up. A second
 * signal exits at once.
 */
export function createShutdown(deps: ShutdownDeps) {
  let running: Promise<void> | null = null
  return (signal: string) => {
    if (running) {
      logEvent('warn', 'shutdown.forced', { signal })
      deps.exit(1)
      return running
    }
    running = (async () => {
      const started = Date.now()
      deps.lifecycle.draining = true
      logEvent('info', 'shutdown.start', { signal, timeoutMs: deps.timeoutMs })
      const serverClosed = new Promise<void>((resolve) => {
        deps.server.close(() => resolve())
      })
      const settled = await within(
        Promise.all([
          deps.stopWorker().catch((error) => logEvent('error', 'shutdown.worker_failed', { message: errorMessage(error) })),
          serverClosed,
        ]),
        deps.timeoutMs,
      )
      const left = Math.max(1_000, deps.timeoutMs - (Date.now() - started))
      await within(deps.db.end(), left)
      logEvent(settled ? 'info' : 'warn', settled ? 'shutdown.done' : 'shutdown.timeout', {
        signal,
        ms: Date.now() - started,
      })
      deps.exit(settled ? 0 : 1)
    })()
    return running
  }
}
