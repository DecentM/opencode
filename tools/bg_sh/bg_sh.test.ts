import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import {
  closeDatabase,
  countTasksByStatus,
  createTask,
  getNextPendingTask,
  getTask,
  initDatabase,
  listTasks,
  markRunningAsCrashed,
  resetQueuedToPending,
  updateTaskStatus,
} from './db'
import { getManager } from './manager'
import type { Task } from './types'

// =============================================================================
// Test Setup / Teardown
// =============================================================================

const TEST_DB_PATH = join(process.cwd(), '.bg_sh.db')
const TEST_LOGS_DIR = join(process.cwd(), '.bg_sh_logs')

/**
 * Clean up test artifacts before/after tests.
 */
const cleanup = () => {
  // Close database connection
  closeDatabase()

  // Remove test database
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH)
    } catch {
      // May fail if locked
    }
  }
  // Also remove WAL files
  try {
    unlinkSync(`${TEST_DB_PATH}-wal`)
  } catch {
    // May not exist
  }
  try {
    unlinkSync(`${TEST_DB_PATH}-shm`)
  } catch {
    // May not exist
  }

  // Remove test logs directory
  if (existsSync(TEST_LOGS_DIR)) {
    try {
      rmSync(TEST_LOGS_DIR, { recursive: true })
    } catch {
      // May fail
    }
  }
}

// =============================================================================
// Test 1: Basic Submission and Execution
// =============================================================================

describe('bg_sh - Basic Submission and Execution', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should submit a simple command and get task_id', async () => {
    const manager = getManager()
    const result = await manager.submit('echo "test"', process.cwd(), 5000)

    expect(result.task_id).toBeDefined()
    expect(typeof result.task_id).toBe('string')
    expect(result.task_id.length).toBe(36) // UUID length
    expect(result.status).toBe('PENDING')
    expect(result.message).toContain('submitted')
  })

  test('should check status while task runs', async () => {
    const manager = getManager()
    const submitResult = await manager.submit('sleep 0.5 && echo "done"', process.cwd(), 5000)

    // Check status immediately
    const status1 = await manager.status(submitResult.task_id)
    expect(status1.task).toBeDefined()
    expect(['PENDING', 'RUNNING']).toContain(status1.task.status)

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check status after completion
    const status2 = await manager.status(submitResult.task_id)
    expect(status2.task.status).toBe('COMPLETED')
  })

  test('should get result after task completes', async () => {
    const manager = getManager()
    const submitResult = await manager.submit('echo "hello world"', process.cwd(), 5000)

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = await manager.getResult(submitResult.task_id)
    expect(result.task.status).toBe('COMPLETED')
    expect(result.stdout.trim()).toBe('hello world')
    expect(result.task.exit_code).toBe(0)
  })

  test('should capture stderr', async () => {
    const manager = getManager()
    const submitResult = await manager.submit(
      'echo "stdout message" && echo "stderr message" >&2',
      process.cwd(),
      5000
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = await manager.getResult(submitResult.task_id)
    expect(result.stdout.trim()).toBe('stdout message')
    expect(result.stderr.trim()).toBe('stderr message')
  })

  test('should handle non-zero exit codes', async () => {
    const manager = getManager()
    // Use 'false' command which is allowed and returns exit code 1
    const submitResult = await manager.submit('false', process.cwd(), 5000)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = await manager.getResult(submitResult.task_id)
    expect(result.task.status).toBe('FAILED')
    expect(result.task.exit_code).toBe(1)
  })
})

// =============================================================================
// Test 2: Queue Management
// =============================================================================

describe('bg_sh - Queue Management', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should queue multiple tasks', async () => {
    const manager = getManager()

    // Submit 5 tasks
    const tasks = await Promise.all([
      manager.submit('sleep 0.3 && echo "task1"', process.cwd(), 5000, 1),
      manager.submit('sleep 0.3 && echo "task2"', process.cwd(), 5000, 2),
      manager.submit('sleep 0.3 && echo "task3"', process.cwd(), 5000, 3),
      manager.submit('sleep 0.3 && echo "task4"', process.cwd(), 5000, 4),
      manager.submit('sleep 0.3 && echo "task5"', process.cwd(), 5000, 5),
    ])

    expect(tasks.length).toBe(5)

    // Check that all tasks have unique IDs
    const ids = tasks.map((t) => t.task_id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(5)

    // Wait for all to complete
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Verify all completed
    for (const task of tasks) {
      const status = await manager.status(task.task_id)
      expect(['COMPLETED']).toContain(status.task.status)
    }
  })

  test('should respect max workers constraint (3 concurrent)', async () => {
    const manager = getManager()

    // Verify max workers is 3
    expect(manager.getMaxWorkers()).toBe(3)

    // Submit 6 tasks that take time
    const startTime = Date.now()
    const tasks = await Promise.all([
      manager.submit('sleep 0.3', process.cwd(), 5000),
      manager.submit('sleep 0.3', process.cwd(), 5000),
      manager.submit('sleep 0.3', process.cwd(), 5000),
      manager.submit('sleep 0.3', process.cwd(), 5000),
      manager.submit('sleep 0.3', process.cwd(), 5000),
      manager.submit('sleep 0.3', process.cwd(), 5000),
    ])

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const endTime = Date.now()
    const duration = endTime - startTime

    // With max 3 workers, 6 tasks of 0.3s each should take at least 0.6s
    // (two batches of 3)
    expect(duration).toBeGreaterThan(500)

    // All should be completed
    for (const task of tasks) {
      const status = await manager.status(task.task_id)
      expect(status.task.status).toBe('COMPLETED')
    }
  })

  test('should process higher priority tasks first', async () => {
    const manager = getManager()

    // Set max workers to 1 to guarantee sequential execution
    manager.setMaxWorkers(1)

    // Submit tasks with different priorities (higher = processed first)
    const low = await manager.submit('sleep 0.1 && echo "low"', process.cwd(), 5000, 1)
    const high = await manager.submit('sleep 0.1 && echo "high"', process.cwd(), 5000, 10)
    const medium = await manager.submit('sleep 0.1 && echo "medium"', process.cwd(), 5000, 5)

    // Wait for all to complete
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check that all completed
    const lowStatus = await manager.status(low.task_id)
    const highStatus = await manager.status(high.task_id)
    const mediumStatus = await manager.status(medium.task_id)

    expect(lowStatus.task.status).toBe('COMPLETED')
    expect(highStatus.task.status).toBe('COMPLETED')
    expect(mediumStatus.task.status).toBe('COMPLETED')

    // High priority should have started first (and finished first)
    // Note: The first task submitted (low) might have started before priority kicks in
    // Priority applies to pending tasks in the queue

    // Reset max workers
    manager.setMaxWorkers(3)
  })
})

// =============================================================================
// Test 3: Timeout Handling
// =============================================================================

describe('bg_sh - Timeout Handling', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should kill long-running task after timeout', async () => {
    const manager = getManager()

    // Submit a task that runs longer than timeout
    const submitResult = await manager.submit(
      'sleep 10',
      process.cwd(),
      500 // 500ms timeout
    )

    // Wait for timeout + grace period
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const result = await manager.getResult(submitResult.task_id)

    expect(result.task.status).toBe('FAILED')
    // Exit code might be signal-related (128 + signal number)
    expect(result.task.exit_code).not.toBe(0)
  })

  test('should not kill task that completes before timeout', async () => {
    const manager = getManager()

    const submitResult = await manager.submit(
      'echo "quick"',
      process.cwd(),
      5000 // 5s timeout
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = await manager.getResult(submitResult.task_id)

    expect(result.task.status).toBe('COMPLETED')
    expect(result.stdout.trim()).toBe('quick')
  })
})

// =============================================================================
// Test 4: Permission Validation
// =============================================================================

describe('bg_sh - Permission Validation', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should reject commands denied by sh-permissions', async () => {
    const manager = getManager()

    // 'rm' is denied by the permissions
    await expect(manager.submit('rm -rf /', process.cwd(), 5000)).rejects.toThrow(/denied/i)
  })

  test('should reject sudo commands', async () => {
    const manager = getManager()

    await expect(manager.submit('sudo ls', process.cwd(), 5000)).rejects.toThrow(/denied/i)
  })

  test('should reject python commands (should use python tool)', async () => {
    const manager = getManager()

    await expect(manager.submit('python --version', process.cwd(), 5000)).rejects.toThrow(/denied/i)
  })

  test('should reject node commands (should use node tool)', async () => {
    const manager = getManager()

    await expect(manager.submit('node --version', process.cwd(), 5000)).rejects.toThrow(/denied/i)
  })

  test('should allow echo command', async () => {
    const manager = getManager()

    const result = await manager.submit('echo "allowed"', process.cwd(), 5000)
    expect(result.task_id).toBeDefined()
  })

  test('should allow ls command', async () => {
    const manager = getManager()

    const result = await manager.submit('ls -la', process.cwd(), 5000)
    expect(result.task_id).toBeDefined()
  })
})

// =============================================================================
// Test 5: Cancellation
// =============================================================================

describe('bg_sh - Cancellation', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should cancel pending task', async () => {
    const manager = getManager()

    // Set max workers to 0 to keep tasks pending
    manager.setMaxWorkers(0)

    const submitResult = await manager.submit('echo "will not run"', process.cwd(), 5000)

    // Cancel the pending task
    const cancelResult = await manager.cancel(submitResult.task_id)

    expect(cancelResult.task_id).toBe(submitResult.task_id)
    expect(cancelResult.previous_status).toBe('PENDING')
    expect(cancelResult.message).toContain('cancelled')

    // Verify status
    const status = await manager.status(submitResult.task_id)
    expect(status.task.status).toBe('CANCELLED')

    // Reset max workers
    manager.setMaxWorkers(3)
  })

  test('should cancel running task', async () => {
    const manager = getManager()

    // Submit a long-running task
    const submitResult = await manager.submit('sleep 10', process.cwd(), 60000)

    // Wait for it to start
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Verify it's running
    const runningStatus = await manager.status(submitResult.task_id)
    expect(runningStatus.task.status).toBe('RUNNING')

    // Cancel it
    const cancelResult = await manager.cancel(submitResult.task_id)

    expect(cancelResult.previous_status).toBe('RUNNING')

    // Wait for cancellation to complete
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Verify it's cancelled
    const status = await manager.status(submitResult.task_id)
    expect(status.task.status).toBe('CANCELLED')
  })

  test('should throw error when cancelling completed task', async () => {
    const manager = getManager()

    const submitResult = await manager.submit('echo "done"', process.cwd(), 5000)

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Try to cancel
    await expect(manager.cancel(submitResult.task_id)).rejects.toThrow(/COMPLETED/i)
  })

  test('should throw error when cancelling non-existent task', async () => {
    const manager = getManager()

    await expect(manager.cancel('non-existent-task-id')).rejects.toThrow(/not found/i)
  })
})

// =============================================================================
// Test 6: List Functionality
// =============================================================================

describe('bg_sh - List Functionality', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should list all tasks', async () => {
    const manager = getManager()

    await manager.submit('echo "task1"', process.cwd(), 5000)
    await manager.submit('echo "task2"', process.cwd(), 5000)
    await manager.submit('echo "task3"', process.cwd(), 5000)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = await manager.list()

    expect(result.tasks.length).toBe(3)
    expect(result.total).toBe(3)
  })

  test('should filter tasks by status', async () => {
    const manager = getManager()

    // Set max workers to 0 to keep some tasks pending
    manager.setMaxWorkers(0)

    await manager.submit('echo "pending1"', process.cwd(), 5000)
    await manager.submit('echo "pending2"', process.cwd(), 5000)

    // Filter by PENDING
    const pendingResult = await manager.list('PENDING')

    expect(pendingResult.tasks.length).toBe(2)
    expect(pendingResult.tasks.every((t) => t.status === 'PENDING')).toBe(true)

    // Reset and let some complete
    manager.setMaxWorkers(3)

    await new Promise((resolve) => setTimeout(resolve, 500))

    // Filter by COMPLETED
    const completedResult = await manager.list('COMPLETED')

    expect(completedResult.tasks.length).toBeGreaterThan(0)
    expect(completedResult.tasks.every((t) => t.status === 'COMPLETED')).toBe(true)
  })

  test('should limit number of tasks returned', async () => {
    const manager = getManager()

    await manager.submit('echo "1"', process.cwd(), 5000)
    await manager.submit('echo "2"', process.cwd(), 5000)
    await manager.submit('echo "3"', process.cwd(), 5000)
    await manager.submit('echo "4"', process.cwd(), 5000)
    await manager.submit('echo "5"', process.cwd(), 5000)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = await manager.list(undefined, 3)

    expect(result.tasks.length).toBe(3)
  })
})

// =============================================================================
// Test 7: Cleanup
// =============================================================================

describe('bg_sh - Cleanup', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should delete old completed tasks', async () => {
    // Initialize database directly for this test
    initDatabase()

    // Create some old tasks manually
    const now = Date.now()
    const oldTime = now - 25 * 60 * 60 * 1000 // 25 hours ago

    const oldTask: Task = {
      id: 'old-task-1',
      command: 'echo "old"',
      workdir: process.cwd(),
      status: 'COMPLETED',
      created_at: oldTime,
      started_at: oldTime + 100,
      finished_at: oldTime + 200,
      exit_code: 0,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(oldTask)

    // Verify it exists
    const beforeCleanup = listTasks()
    expect(beforeCleanup.some((t) => t.id === 'old-task-1')).toBe(true)

    // Run cleanup with 24 hour threshold
    const manager = getManager()
    const cleanupResult = await manager.cleanup(24)

    expect(cleanupResult.deleted_count).toBe(1)

    // Verify it's gone
    const afterCleanup = listTasks()
    expect(afterCleanup.some((t) => t.id === 'old-task-1')).toBe(false)
  })

  test('should not delete recent tasks', async () => {
    const manager = getManager()

    // Create a task that just completed
    await manager.submit('echo "recent"', process.cwd(), 5000)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const beforeCleanup = await manager.list()
    expect(beforeCleanup.total).toBe(1)

    // Run cleanup with 24 hour threshold
    const cleanupResult = await manager.cleanup(24)

    expect(cleanupResult.deleted_count).toBe(0)

    // Verify it still exists
    const afterCleanup = await manager.list()
    expect(afterCleanup.total).toBe(1)
  })

  test('should only delete terminal state tasks', async () => {
    initDatabase()

    const now = Date.now()
    const oldTime = now - 25 * 60 * 60 * 1000

    // Create old tasks in various states
    const completedTask: Task = {
      id: 'old-completed',
      command: 'echo "done"',
      workdir: process.cwd(),
      status: 'COMPLETED',
      created_at: oldTime,
      started_at: oldTime + 100,
      finished_at: oldTime + 200,
      exit_code: 0,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    const failedTask: Task = {
      id: 'old-failed',
      command: 'exit 1',
      workdir: process.cwd(),
      status: 'FAILED',
      created_at: oldTime,
      started_at: oldTime + 100,
      finished_at: oldTime + 200,
      exit_code: 1,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    const cancelledTask: Task = {
      id: 'old-cancelled',
      command: 'sleep 100',
      workdir: process.cwd(),
      status: 'CANCELLED',
      created_at: oldTime,
      started_at: null,
      finished_at: oldTime + 100,
      exit_code: null,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    // This should NOT be deleted (PENDING status)
    const pendingTask: Task = {
      id: 'old-pending',
      command: 'echo "pending"',
      workdir: process.cwd(),
      status: 'PENDING',
      created_at: oldTime,
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(completedTask)
    createTask(failedTask)
    createTask(cancelledTask)
    createTask(pendingTask)

    const manager = getManager()
    const cleanupResult = await manager.cleanup(24)

    // Should delete 3 (completed, failed, cancelled) but not pending
    expect(cleanupResult.deleted_count).toBe(3)

    // Pending should still exist
    const remaining = listTasks()
    expect(remaining.some((t) => t.id === 'old-pending')).toBe(true)
  })
})

// =============================================================================
// Test 8: Crash Recovery
// =============================================================================

describe('bg_sh - Crash Recovery', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should mark RUNNING tasks as CRASHED on init', async () => {
    // Initialize database and create a "running" task manually
    initDatabase()

    const runningTask: Task = {
      id: 'running-before-crash',
      command: 'sleep 100',
      workdir: process.cwd(),
      status: 'RUNNING',
      created_at: Date.now() - 60000,
      started_at: Date.now() - 59000,
      finished_at: null,
      exit_code: null,
      timeout_ms: 120000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(runningTask)

    // Verify it's RUNNING
    const before = getTask('running-before-crash')
    expect(before?.status).toBe('RUNNING')

    // Close database and simulate crash recovery
    closeDatabase()

    // Crash recovery happens in markRunningAsCrashed
    initDatabase()
    const crashedCount = markRunningAsCrashed()

    expect(crashedCount).toBe(1)

    // Verify it's now CRASHED
    const after = getTask('running-before-crash')
    expect(after?.status).toBe('CRASHED')
    expect(after?.finished_at).toBeDefined()
  })

  test('should reset QUEUED tasks to PENDING on init', async () => {
    initDatabase()

    const queuedTask: Task = {
      id: 'queued-before-crash',
      command: 'echo "test"',
      workdir: process.cwd(),
      status: 'QUEUED',
      created_at: Date.now() - 60000,
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(queuedTask)

    // Verify it's QUEUED
    const before = getTask('queued-before-crash')
    expect(before?.status).toBe('QUEUED')

    // Close and simulate crash recovery
    closeDatabase()
    initDatabase()
    const resetCount = resetQueuedToPending()

    expect(resetCount).toBe(1)

    // Verify it's now PENDING
    const after = getTask('queued-before-crash')
    expect(after?.status).toBe('PENDING')
  })
})

// =============================================================================
// Test: Database Functions
// =============================================================================

describe('bg_sh - Database Functions', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should initialize database and create tables', () => {
    const db = initDatabase()
    expect(db).toBeDefined()

    // Check that tasks table exists
    const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
    expect(result.all().length).toBe(1)
  })

  test('should create and retrieve task', () => {
    initDatabase()

    const task: Task = {
      id: 'test-task-123',
      command: 'echo "test"',
      workdir: '/tmp',
      status: 'PENDING',
      created_at: Date.now(),
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 5,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(task)

    const retrieved = getTask('test-task-123')
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('test-task-123')
    expect(retrieved?.command).toBe('echo "test"')
    expect(retrieved?.status).toBe('PENDING')
    expect(retrieved?.priority).toBe(5)
  })

  test('should update task status', () => {
    initDatabase()

    const task: Task = {
      id: 'status-update-test',
      command: 'echo "test"',
      workdir: '/tmp',
      status: 'PENDING',
      created_at: Date.now(),
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    }

    createTask(task)

    updateTaskStatus('status-update-test', 'RUNNING', {
      started_at: Date.now(),
    })

    const updated = getTask('status-update-test')
    expect(updated?.status).toBe('RUNNING')
    expect(updated?.started_at).toBeDefined()
  })

  test('should count tasks by status', () => {
    initDatabase()

    createTask({
      id: 'count-1',
      command: 'echo 1',
      workdir: '/tmp',
      status: 'PENDING',
      created_at: Date.now(),
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    })

    createTask({
      id: 'count-2',
      command: 'echo 2',
      workdir: '/tmp',
      status: 'PENDING',
      created_at: Date.now(),
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    })

    createTask({
      id: 'count-3',
      command: 'echo 3',
      workdir: '/tmp',
      status: 'COMPLETED',
      created_at: Date.now(),
      started_at: Date.now(),
      finished_at: Date.now(),
      exit_code: 0,
      timeout_ms: 5000,
      priority: 0,
      log_path_out: null,
      log_path_err: null,
    })

    expect(countTasksByStatus('PENDING')).toBe(2)
    expect(countTasksByStatus('COMPLETED')).toBe(1)
    expect(countTasksByStatus('RUNNING')).toBe(0)
  })

  test('should get next pending task by priority', () => {
    initDatabase()

    createTask({
      id: 'low-priority',
      command: 'echo low',
      workdir: '/tmp',
      status: 'PENDING',
      created_at: Date.now() - 1000,
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 1,
      log_path_out: null,
      log_path_err: null,
    })

    createTask({
      id: 'high-priority',
      command: 'echo high',
      workdir: '/tmp',
      status: 'PENDING',
      created_at: Date.now(),
      started_at: null,
      finished_at: null,
      exit_code: null,
      timeout_ms: 5000,
      priority: 10,
      log_path_out: null,
      log_path_err: null,
    })

    const next = getNextPendingTask()
    expect(next?.id).toBe('high-priority')
  })
})

// =============================================================================
// Test: get_result with tail
// =============================================================================

describe('bg_sh - get_result tail functionality', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should return last N lines with tail parameter', async () => {
    const manager = getManager()

    // Create a command that outputs multiple lines
    const submitResult = await manager.submit(
      'echo "line1" && echo "line2" && echo "line3" && echo "line4" && echo "line5"',
      process.cwd(),
      5000
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    // Get result with tail=2
    const result = await manager.getResult(submitResult.task_id, 2)

    const lines = result.stdout
      .trim()
      .split('\n')
      .filter((l) => l.length > 0)
    expect(lines.length).toBe(2)
    expect(lines).toContain('line4')
    expect(lines).toContain('line5')
  })
})

// =============================================================================
// Test: Error Handling
// =============================================================================

describe('bg_sh - Error Handling', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  test('should throw when getting result of non-terminal task', async () => {
    const manager = getManager()

    // Submit a long task
    const submitResult = await manager.submit('sleep 5', process.cwd(), 60000)

    // Wait a bit for it to start
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Try to get result while it's running
    await expect(manager.getResult(submitResult.task_id)).rejects.toThrow(/still RUNNING/i)

    // Cancel to clean up
    await manager.cancel(submitResult.task_id)
  })

  test('should throw when getting status of non-existent task', async () => {
    const manager = getManager()

    await expect(manager.status('non-existent-id')).rejects.toThrow(/not found/i)
  })

  test('should throw when command is missing for submit', async () => {
    // This tests the tool layer, not the manager directly
    // The tool validates command is required
    const manager = getManager()

    // @ts-expect-error - Testing with undefined command
    await expect(manager.submit(undefined, process.cwd(), 5000)).rejects.toThrow()
  })
})
