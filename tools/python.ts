/**
 * Python code execution tool with direct process spawning.
 * Each execution spawns a fresh python3 process.
 * Supports parallel executions.
 */

import { tool } from '@opencode-ai/plugin'
import { formatExecutionResult, formatNoCodeError } from '../lib/format'

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_PYTHON_VERSION = '3.12'

// =============================================================================
// Process Runner
// =============================================================================

/**
 * Spawn a python3 process, pipe code to stdin, and collect output.
 */
const runPythonProcess = async (options: {
  code: string
  timeout: number
  packages: string[]
}): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}> => {
  const { code, timeout, packages } = options
  const startTime = performance.now()
  let timedOut = false

  // Install packages first if requested
  if (packages.length > 0) {
    const installProc = Bun.spawn(['pip', 'install', '--quiet', ...packages], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    await installProc.exited

    if (installProc.exitCode !== 0) {
      const stderr = await new Response(installProc.stderr).text()
      return {
        exitCode: installProc.exitCode ?? -1,
        stdout: '',
        stderr: `Failed to install packages: ${stderr}`,
        durationMs: Math.round(performance.now() - startTime),
        timedOut: false,
      }
    }
  }

  const proc = Bun.spawn(['python3', '-'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Write code to stdin and close
  proc.stdin.write(code)
  proc.stdin.end()

  // Race between process completion and timeout
  const timeoutId = setTimeout(() => {
    timedOut = true
    proc.kill('SIGTERM')
    // Force kill after 2 seconds if still alive
    setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        // Process may already be dead
      }
    }, 2_000)
  }, timeout)

  await proc.exited
  clearTimeout(timeoutId)

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const durationMs = Math.round(performance.now() - startTime)

  return {
    exitCode: timedOut ? -2 : (proc.exitCode ?? -1),
    stdout,
    stderr: timedOut
      ? `Execution timed out after ${timeout}ms and was terminated.\n${stderr}`.trim()
      : stderr,
    durationMs,
    timedOut,
  }
}

// =============================================================================
// Main Tool
// =============================================================================

export default tool({
  description: `Execute Python code in a python3 process.

Features:
- Fresh process per execution (parallel-safe)
- Preinstallable pip packages

Returns stdout, stderr, and exit code.`,
  args: {
    code: tool.schema.string().describe('Python code to execute'),
    timeout: tool.schema.number().describe('Timeout in milliseconds'),
    packages: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe('List of packages to preinstall (add some timeout for each)'),
    python_version: tool.schema
      .string()
      .optional()
      .describe(
        `Python version (ignored — uses system python3, default: ${DEFAULT_PYTHON_VERSION})`
      ),
  },
  async execute(args) {
    const { code, timeout = DEFAULT_TIMEOUT_MS, packages = [] } = args

    if (!code.trim()) {
      return formatNoCodeError()
    }

    const result = await runPythonProcess({ code, timeout, packages })

    return formatExecutionResult({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    })
  },
})
