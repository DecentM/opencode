/**
 * Node.js/TypeScript code execution tool with direct process spawning.
 * Each execution spawns a fresh node process.
 * Supports parallel executions.
 */

import { tool } from '@opencode-ai/plugin'
import { formatExecutionResult, formatNoCodeError } from '../lib/format'

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000

// =============================================================================
// Process Runner
// =============================================================================

/**
 * Spawn a node process, pipe code to stdin, and collect output.
 */
const runNodeProcess = async (options: {
  code: string
  timeout: number
  packages: string[]
  esm: boolean
}): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}> => {
  const { code, timeout, packages, esm } = options
  const startTime = performance.now()
  let timedOut = false

  // Install packages first if requested
  if (packages.length > 0) {
    const installProc = Bun.spawn(['npm', 'install', '--no-save', ...packages], {
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

  const inputType = esm ? 'module' : 'commonjs'
  const proc = Bun.spawn(['node', `--input-type=${inputType}`, '-'], {
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
  description: `Execute JavaScript/TypeScript code in a Node.js process.

Features:
- Fresh process per execution (parallel-safe)
- Preinstallable npm packages
- ESM or CommonJS mode

Returns stdout, stderr, and exit code.`,
  args: {
    code: tool.schema.string().describe('JavaScript or TypeScript code to execute'),
    timeout: tool.schema.number().describe('Timeout in milliseconds'),
    packages: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe('List of packages to preinstall (add some timeout for each)'),
    node_version: tool.schema
      .string()
      .optional()
      .describe(`Node version (ignored — uses system Node ${process.versions.node})`),
    esm: tool.schema
      .boolean()
      .optional()
      .describe(
        'If false, the sandbox will be set up for commonjs. If true, it will be ESM ("module"). Default: true'
      ),
  },
  async execute(args) {
    const { code, timeout = DEFAULT_TIMEOUT_MS, packages = [], esm = true } = args

    if (!code.trim()) {
      return formatNoCodeError()
    }

    const result = await runNodeProcess({ code, timeout, packages, esm })

    return formatExecutionResult({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    })
  },
})
