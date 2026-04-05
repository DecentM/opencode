/**
 * Type definitions for execution result formatting.
 */

/**
 * Result for formatting execution output (e.g. from sandbox tools).
 */
export interface ExecutionResult {
  /** Exit code from the process */
  exitCode: number

  /** Standard output */
  stdout: string

  /** Standard error */
  stderr: string

  /** Duration in milliseconds */
  durationMs: number

  /** Whether the execution timed out */
  timedOut: boolean

  /** Runtime identifier (e.g., 'node', 'python') */
  runtime?: string
}
