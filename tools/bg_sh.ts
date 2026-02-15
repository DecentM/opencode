import { tool } from '@opencode-ai/plugin'

import { getManager } from './bg_sh/manager'
import type { TaskStatus } from './bg_sh/types'

export default tool({
  description: `Execute shell commands in the background with queue management.

Uses the same permission system as the sh tool.

Actions:
- submit: Submit a new background task
- status: Get status of a specific task
- get_result: Get logs of a completed task
- list: List tasks with optional filters
- cancel: Cancel a pending or running task
- cleanup: Delete old completed tasks

Task lifecycle: PENDING → RUNNING → COMPLETED/FAILED/CANCELLED/CRASHED`,
  args: {
    action: tool.schema
      .enum(['submit', 'status', 'get_result', 'list', 'cancel', 'cleanup'])
      .describe('The action to perform'),
    // submit args
    command: tool.schema.string().optional().describe('Shell command to execute (for submit)'),
    workdir: tool.schema.string().optional().describe('Working directory (for submit)'),
    timeout_ms: tool.schema
      .number()
      .optional()
      .describe('Timeout in milliseconds (for submit, default 30000)'),
    priority: tool.schema
      .number()
      .optional()
      .describe('Priority (higher = processed first, for submit)'),
    // status/get_result/cancel args
    task_id: tool.schema.string().optional().describe('Task ID (for status, get_result, cancel)'),
    // get_result args
    tail: tool.schema.number().optional().describe('Number of log lines from end (for get_result)'),
    // list args
    status: tool.schema
      .enum(['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'CRASHED'])
      .optional()
      .describe('Filter by status (for list)'),
    limit: tool.schema.number().optional().describe('Max number of tasks to return (for list)'),
    // cleanup args
    older_than_hours: tool.schema
      .number()
      .optional()
      .describe('Delete tasks older than this (for cleanup, default 24)'),
  },
  async execute(args) {
    const { action } = args
    const manager = getManager()

    try {
      switch (action) {
        // ─────────────────────────────────────────────────────────────────────
        // Submit
        // ─────────────────────────────────────────────────────────────────────
        case 'submit': {
          if (!args.command) {
            return 'Error: command is required for submit action'
          }

          const result = await manager.submit(
            args.command,
            args.workdir,
            args.timeout_ms,
            args.priority
          )

          return formatSubmitResult(result)
        }

        // ─────────────────────────────────────────────────────────────────────
        // Status
        // ─────────────────────────────────────────────────────────────────────
        case 'status': {
          if (!args.task_id) {
            return 'Error: task_id is required for status action'
          }

          const result = await manager.status(args.task_id)
          return formatStatusResult(result)
        }

        // ─────────────────────────────────────────────────────────────────────
        // Get Result
        // ─────────────────────────────────────────────────────────────────────
        case 'get_result': {
          if (!args.task_id) {
            return 'Error: task_id is required for get_result action'
          }

          const result = await manager.getResult(args.task_id, args.tail)
          return formatGetResultResult(result)
        }

        // ─────────────────────────────────────────────────────────────────────
        // List
        // ─────────────────────────────────────────────────────────────────────
        case 'list': {
          const result = await manager.list(args.status as TaskStatus | undefined, args.limit)
          return formatListResult(result)
        }

        // ─────────────────────────────────────────────────────────────────────
        // Cancel
        // ─────────────────────────────────────────────────────────────────────
        case 'cancel': {
          if (!args.task_id) {
            return 'Error: task_id is required for cancel action'
          }

          const result = await manager.cancel(args.task_id)
          return formatCancelResult(result)
        }

        // ─────────────────────────────────────────────────────────────────────
        // Cleanup
        // ─────────────────────────────────────────────────────────────────────
        case 'cleanup': {
          const result = await manager.cleanup(args.older_than_hours)
          return formatCleanupResult(result)
        }

        default:
          return `Error: Unknown action: ${action}`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return `Error: ${errorMessage}`
    }
  },
})

// =============================================================================
// Formatters
// =============================================================================

interface SubmitResult {
  task_id: string
  status: TaskStatus
  message: string
}

const formatSubmitResult = (result: SubmitResult): string => {
  return `# Task Submitted

- **Task ID**: ${result.task_id}
- **Status**: ${result.status}

${result.message}`
}

interface Task {
  id: string
  command: string
  workdir: string
  status: TaskStatus
  created_at: number
  started_at: number | null
  finished_at: number | null
  exit_code: number | null
  timeout_ms: number
  priority: number
}

interface StatusResult {
  task: Task
}

const formatStatusResult = (result: StatusResult): string => {
  const { task } = result
  const created = new Date(task.created_at).toISOString()
  const started = task.started_at ? new Date(task.started_at).toISOString() : '-'
  const finished = task.finished_at ? new Date(task.finished_at).toISOString() : '-'
  const duration =
    task.started_at && task.finished_at
      ? `${((task.finished_at - task.started_at) / 1000).toFixed(2)}s`
      : '-'

  return `# Task Status

- **Task ID**: ${task.id}
- **Status**: ${task.status}
- **Command**: \`${task.command}\`
- **Workdir**: ${task.workdir}
- **Priority**: ${task.priority}
- **Timeout**: ${task.timeout_ms}ms
- **Exit Code**: ${task.exit_code ?? '-'}

## Timestamps
- **Created**: ${created}
- **Started**: ${started}
- **Finished**: ${finished}
- **Duration**: ${duration}`
}

interface GetResultResult {
  task: Task
  stdout: string
  stderr: string
}

const formatGetResultResult = (result: GetResultResult): string => {
  const { task, stdout, stderr } = result
  const exitInfo = task.exit_code !== null ? `Exit code: ${task.exit_code}` : 'Exit code: unknown'

  let output = `# Task Result

- **Task ID**: ${task.id}
- **Status**: ${task.status}
- **${exitInfo}**

## stdout
\`\`\`
${stdout || '(empty)'}
\`\`\`

## stderr
\`\`\`
${stderr || '(empty)'}
\`\`\``

  // Truncate if too long
  const MAX_OUTPUT = 50 * 1024 // 50KB
  if (output.length > MAX_OUTPUT) {
    output = `${output.substring(0, MAX_OUTPUT)}\n...[truncated, ${output.length} bytes total]`
  }

  return output
}

interface ListResult {
  tasks: Task[]
  total: number
}

const formatListResult = (result: ListResult): string => {
  if (result.tasks.length === 0) {
    return 'No tasks found'
  }

  let output = '# Background Tasks\n\n'
  output += '| ID (short) | Status | Command | Priority | Created |\n'
  output += '|------------|--------|---------|----------|----------|\n'

  for (const task of result.tasks) {
    const shortId = task.id.substring(0, 8)
    const cmd = task.command.length > 30 ? `${task.command.substring(0, 30)}...` : task.command
    const created = new Date(task.created_at).toISOString().substring(0, 19)
    output += `| ${shortId} | ${task.status} | \`${cmd}\` | ${task.priority} | ${created} |\n`
  }

  output += `\n**Total**: ${result.total} task(s)`

  return output
}

interface CancelResult {
  task_id: string
  previous_status: TaskStatus
  message: string
}

const formatCancelResult = (result: CancelResult): string => {
  return `# Task Cancelled

- **Task ID**: ${result.task_id}
- **Previous Status**: ${result.previous_status}

${result.message}`
}

interface CleanupResult {
  deleted_count: number
  message: string
}

const formatCleanupResult = (result: CleanupResult): string => {
  return `# Cleanup Complete

${result.message}`
}
