import { readFile } from 'node:fs/promises'

import { validateWorkdir } from '../../lib/shell'
import { matchCommand, validateConstraints } from '../sh/index'
import {
  countTasksByStatus,
  createTask,
  deleteOldTasks,
  getNextPendingTask,
  getTask,
  initDatabase,
  listTasks,
  markRunningAsCrashed,
  resetQueuedToPending,
  updateTaskStatus,
} from './db'

import type {
  ActiveWorker,
  CancelResult,
  CleanupResult,
  GetResultResult,
  ListResult,
  StatusResult,
  SubmitResult,
  Task,
  TaskStatus,
} from './types'
import { type WorkerResult, cancelTask, executeTask, getLogPaths } from './worker'

const DEFAULT_MAX_WORKERS = 3
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_CLEANUP_HOURS = 24

class TaskManager {
  private static instance: TaskManager | null = null
  private initialized = false
  private maxWorkers: number
  private activeWorkers: Map<string, ActiveWorker> = new Map()

  private constructor() {
    this.maxWorkers = DEFAULT_MAX_WORKERS
  }

  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager()
    }
    return TaskManager.instance
  }

  public async init(): Promise<void> {
    if (this.initialized) return

    // Initialize database
    initDatabase()

    // Crash recovery: mark RUNNING tasks as CRASHED
    const crashedCount = markRunningAsCrashed()
    if (crashedCount > 0) {
      console.log(`[bg_sh] Marked ${crashedCount} running task(s) as CRASHED`)
    }

    // Reset QUEUED tasks to PENDING
    const resetCount = resetQueuedToPending()
    if (resetCount > 0) {
      console.log(`[bg_sh] Reset ${resetCount} queued task(s) to PENDING`)
    }

    this.initialized = true

    // Process any pending tasks
    this.processQueue()
  }

  /**
   * Submit a new task.
   */
  public async submit(
    command: string,
    workdir?: string,
    timeoutMs?: number,
    priority?: number
  ): Promise<SubmitResult> {
    await this.init()

    const effectiveWorkdir = workdir ?? process.cwd()
    const effectiveTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS

    // Validate command against sh permissions
    const match = matchCommand(command)

    if (match.decision === 'deny') {
      const reason = match.reason ?? 'Command not in allowlist'
      const patternInfo = match.pattern ? ` (pattern: ${match.pattern})` : ''
      throw new Error(`Command denied: ${reason}${patternInfo}`)
    }

    // Check constraints for allowed commands
    if (match.rule) {
      // Validate workdir is under cwd
      validateWorkdir(effectiveWorkdir)

      const constraintResult = validateConstraints(command, effectiveWorkdir, match.rule)

      if (!constraintResult.valid) {
        throw new Error(constraintResult.violation)
      }
    }

    // Create task
    const taskId = crypto.randomUUID()
    const task: Task = {
      id: taskId,
      command,
      workdir: effectiveWorkdir,
      status: 'PENDING',
      created_at: Date.now(),
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: effectiveTimeout,
      priority: priority ?? 0,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(task)

    // Trigger queue processing
    this.processQueue()

    return {
      task_id: taskId,
      status: 'PENDING',
      message: 'Task submitted successfully',
    }
  }

  public async status(taskId: string): Promise<StatusResult> {
    await this.init()

    const task = getTask(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    return { task }
  }

  public async getResult(taskId: string, tail?: number): Promise<GetResultResult> {
    await this.init()

    const task = getTask(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    // Check if task is in a terminal state
    const terminalStates: TaskStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED', 'CRASHED']
    if (!terminalStates.includes(task.status)) {
      throw new Error(`Task ${taskId} is still ${task.status}. Wait for completion.`)
    }

    // Read log files
    let stdout = ''
    let stderr = ''

    const logPaths = getLogPaths(taskId)

    try {
      stdout = await readFile(logPaths.stdout, 'utf-8')
    } catch {
      // File may not exist if task crashed before starting
    }

    try {
      stderr = await readFile(logPaths.stderr, 'utf-8')
    } catch {
      // File may not exist if task crashed before starting
    }

    // Apply tail if specified
    if (tail !== undefined && tail > 0) {
      const tailLines = (text: string, n: number): string => {
        // Filter out empty lines caused by trailing newlines
        const lines = text.split('\n').filter((line) => line.length > 0)
        return lines.slice(-n).join('\n')
      }
      stdout = tailLines(stdout, tail)
      stderr = tailLines(stderr, tail)
    }

    return { task, stdout, stderr }
  }

  public async list(status?: TaskStatus, limit?: number): Promise<ListResult> {
    await this.init()

    const tasks = listTasks({ status, limit })
    const total = tasks.length

    return { tasks, total }
  }

  public async cancel(taskId: string): Promise<CancelResult> {
    await this.init()

    const task = getTask(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    const previousStatus = task.status

    // Only PENDING and RUNNING tasks can be cancelled
    if (previousStatus !== 'PENDING' && previousStatus !== 'RUNNING') {
      throw new Error(`Cannot cancel task in ${previousStatus} state`)
    }

    if (previousStatus === 'RUNNING') {
      // Kill the running process
      const worker = this.activeWorkers.get(taskId)
      if (worker) {
        await cancelTask(worker.proc)
        this.activeWorkers.delete(taskId)
      }
    }

    // Update status
    updateTaskStatus(taskId, 'CANCELLED', {
      finished_at: Date.now(),
    })

    return {
      task_id: taskId,
      previous_status: previousStatus,
      message: 'Task cancelled successfully',
    }
  }

  public async cleanup(olderThanHours?: number): Promise<CleanupResult> {
    await this.init()

    const hours = olderThanHours ?? DEFAULT_CLEANUP_HOURS
    const olderThanMs = hours * 60 * 60 * 1000

    const deletedCount = deleteOldTasks(olderThanMs)

    return {
      deleted_count: deletedCount,
      message: `Deleted ${deletedCount} task(s) older than ${hours} hours`,
    }
  }

  private processQueue(): void {
    // Check if we can start more workers
    const runningCount = countTasksByStatus('RUNNING')
    const availableSlots = this.maxWorkers - runningCount

    if (availableSlots <= 0) {
      return
    }

    // Get next pending task
    const task = getNextPendingTask()
    if (!task) {
      return
    }

    // Start the worker
    this.startWorker(task)

    // Recursively process more if slots available
    if (availableSlots > 1) {
      // Use setImmediate to avoid blocking
      setImmediate(() => this.processQueue())
    }
  }

  private startWorker(task: Task): void {
    // Execute the task
    executeTask(task, (taskId: string, _result: WorkerResult) => {
      // Remove from active workers
      this.activeWorkers.delete(taskId)

      // Process next task in queue
      this.processQueue()
    }).then((proc) => {
      // Track active worker
      this.activeWorkers.set(task.id, {
        task_id: task.id,
        proc,
        started_at: Date.now(),
      })
    })
  }

  public getActiveWorkerCount(): number {
    return this.activeWorkers.size
  }

  public getMaxWorkers(): number {
    return this.maxWorkers
  }

  public setMaxWorkers(count: number): void {
    this.maxWorkers = count
    // Process queue in case more slots are now available
    this.processQueue()
  }
}

export const getManager = (): TaskManager => {
  return TaskManager.getInstance()
}
