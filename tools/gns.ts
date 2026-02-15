/**
 * Custom GNS tool with permission enforcement.
 * Executes gns CLI commands with:
 * - Allowlist-based operation permissions
 * - Keyspace constraints for write operations
 * - Timeout handling with graceful shutdown
 */

import { tool } from '@opencode-ai/plugin'

import {
  type ValidationContext,
  buildOperationPattern,
  extractKey,
  matchOperation,
  validateConstraints,
} from './gns/index'

// =============================================================================
// Main GNS Tool
// =============================================================================

export default tool({
  description: `Execute GNS (Graph Namespace) operations with permission enforcement.
Operations are checked against an allowlist before execution.
Denied operations will return an error with the reason.

Executes the gns CLI binary directly.`,
  args: {
    command: tool.schema
      .string()
      .describe('The GNS command to execute (e.g., "get", "set", "list", "auth status")'),
    args: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe('Arguments to pass to the command'),
    timeout: tool.schema.number().optional().describe('Timeout in milliseconds (default 30000)'),
  },
  async execute(args) {
    const { command, args: cmdArgs = [], timeout = 30000 } = args

    if (timeout < 1000) {
      return 'Error: Timeout must be at least 1000ms (1 second)'
    }

    // Build the operation pattern for matching
    const operationPattern = buildOperationPattern(command, cmdArgs)

    // Check permissions
    const match = matchOperation(operationPattern)

    if (match.decision === 'deny') {
      // Standardized error format
      const reason = match.reason ?? 'Operation not in allowlist'
      const patternInfo = match.pattern ? `\nPattern: ${match.pattern}` : ''
      return `Error: Operation denied\nReason: ${reason}${patternInfo}\n\nOperation: ${operationPattern}`
    }

    // Build validation context for constraints
    const validationContext: ValidationContext = {
      key: extractKey(cmdArgs),
      args: cmdArgs,
    }

    // Check constraints for allowed operations
    if (match.rule) {
      const constraintResult = validateConstraints(match.rule, validationContext)

      if (!constraintResult.valid) {
        return `Error: ${constraintResult.violation}\nPattern: ${match.pattern}\n\nOperation: ${operationPattern}`
      }
    }

    try {
      const result = await executeGnsCommand(command, cmdArgs, timeout)

      if (!result.success) {
        return `Error: ${result.error}\n\nOperation: ${operationPattern}`
      }

      return result.output
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return `Error: Command execution failed: ${errorMessage}\n\nOperation: ${operationPattern}`
    }
  },
})

// =============================================================================
// Helper Functions
// =============================================================================

interface ExecutionResult {
  success: boolean
  output: string
  error?: string
}

/**
 * Execute a GNS CLI command.
 */
const executeGnsCommand = async (
  command: string,
  args: string[],
  timeout: number
): Promise<ExecutionResult> => {
  // Build the full command array
  // Handle compound commands like "auth status" by splitting
  const commandParts = command.split(/\s+/)
  const fullArgs = [...commandParts, ...args]

  // Spawn the gns process
  const proc = Bun.spawn(['gns', ...fullArgs], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  /**
   * Terminate process with signal escalation.
   * Tries SIGTERM first, then SIGKILL after grace period.
   */
  const terminateProcess = async (): Promise<void> => {
    try {
      // First attempt: SIGTERM (graceful)
      proc.kill('SIGTERM')

      // Wait briefly for graceful shutdown
      const gracePeriod = 1000 // 1 second
      const exited = await Promise.race([
        proc.exited.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), gracePeriod)),
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

  // Handle timeout with proper cleanup
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    terminateProcess()
  }, timeout)

  // Wait for completion
  const exitCode = await proc.exited
  clearTimeout(timeoutId)

  // Read output
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

  // Handle timeout case
  if (timedOut) {
    return {
      success: false,
      output: '',
      error: `Command timed out after ${timeout}ms and was terminated`,
    }
  }

  // Format output
  let output = ''
  if (stdout.trim()) {
    output += stdout
  }
  if (stderr.trim()) {
    if (output) output += '\n'
    output += `[stderr]\n${stderr}`
  }

  // Truncate if too long
  const MAX_OUTPUT = 50 * 1024 // 50KB
  if (output.length > MAX_OUTPUT) {
    output = `${output.substring(0, MAX_OUTPUT)}\n...[truncated, ${output.length} bytes total]`
  }

  if (exitCode !== 0) {
    return `Error: Command exited with code ${exitCode}\nOutput: ${output}`
  }

  return output || '(no output)'
}
