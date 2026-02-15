import type { KillableProcess } from './types'

const DEFAULT_GRACE_PERIOD_MS = 1000

export const gracefulKill = async (
  proc: KillableProcess,
  gracePeriodMs: number = DEFAULT_GRACE_PERIOD_MS
): Promise<void> => {
  try {
    // First attempt: SIGTERM (graceful)
    proc.kill('SIGTERM')

    // Wait briefly for graceful shutdown
    const exited = await Promise.race([
      proc.exited.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), gracePeriodMs)),
    ])

    // If still running, escalate to SIGKILL
    if (!exited) {
      try {
        proc.kill('SIGKILL')
      } catch {
        // Process may have exited between check and kill
      }
    }
  } catch {
    // Process may have already exited
  }
}
