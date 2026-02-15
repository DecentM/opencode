import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { gracefulKill } from '../../lib/shell'
import { updateTaskStatus } from './db'
import type { Task, TaskStatus } from './types'

const LOGS_DIR = '.bg_sh_logs'

export const getLogsDir = (): string => {
  return join(process.cwd(), LOGS_DIR)
}

export const ensureLogsDir = async (): Promise<void> => {
  await mkdir(getLogsDir(), { recursive: true })
}

export const getLogPaths = (taskId: string): { stdout: string; stderr: string } => {
  const dir = getLogsDir()
  return {
    stdout: join(dir, `${taskId}.out`),
    stderr: join(dir, `${taskId}.err`),
  }
}

export interface WorkerResult {
  exitCode: number
  timedOut: boolean
  status: TaskStatus
}

export const executeTask = async (
  task: Task,
  onComplete: (taskId: string, result: WorkerResult) => void
): Promise<ReturnType<typeof Bun.spawn>> => {
  // Ensure logs directory exists
  await ensureLogsDir()

  // Get log file paths
  const logPaths = getLogPaths(task.id)

  // Open log files for writing
  const stdoutFile = Bun.file(logPaths.stdout)
  const stderrFile = Bun.file(logPaths.stderr)
  const stdoutWriter = stdoutFile.writer()
  const stderrWriter = stderrFile.writer()

  // Update task with log paths and mark as RUNNING
  updateTaskStatus(task.id, 'RUNNING', {
    started_at: Date.now(),
    log_path_out: logPaths.stdout,
    log_path_err: logPaths.stderr,
  })

  // Spawn the process
  const proc = Bun.spawn(['sh', '-c', task.command], {
    cwd: task.workdir,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Stream stdout to file
  const streamStdout = async () => {
    try {
      const reader = proc.stdout.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          stdoutWriter.write(value)
        }
      }
    } catch {
      // Process may have exited
    } finally {
      await stdoutWriter.end()
    }
  }

  // Stream stderr to file
  const streamStderr = async () => {
    try {
      const reader = proc.stderr.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          stderrWriter.write(value)
        }
      }
    } catch {
      // Process may have exited
    } finally {
      await stderrWriter.end()
    }
  }

  // Start streaming (don't await - run in background)
  const stdoutPromise = streamStdout()
  const stderrPromise = streamStderr()

  // Handle timeout
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    gracefulKill(proc)
  }, task.timeout_ms)

  // Handle completion
  proc.exited
    .then(async (exitCode) => {
      clearTimeout(timeoutId)

      // Wait for streams to finish
      await Promise.all([stdoutPromise, stderrPromise])

      // Determine final status
      let status: TaskStatus
      if (timedOut) {
        status = 'FAILED'
      } else if (exitCode === 0) {
        status = 'COMPLETED'
      } else {
        status = 'FAILED'
      }

      // Update task in database
      updateTaskStatus(task.id, status, {
        finished_at: Date.now(),
        exit_code: exitCode,
      })

      // Notify completion
      onComplete(task.id, { exitCode, timedOut, status })
    })
    .catch(async () => {
      clearTimeout(timeoutId)

      // Wait for streams to finish
      await Promise.all([stdoutPromise, stderrPromise])

      // Update task as crashed
      updateTaskStatus(task.id, 'CRASHED', {
        finished_at: Date.now(),
      })

      onComplete(task.id, { exitCode: -1, timedOut: false, status: 'CRASHED' })
    })

  return proc
}

export const cancelTask = async (proc: ReturnType<typeof Bun.spawn>): Promise<void> => {
  await gracefulKill(proc)
}
