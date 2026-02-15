import { tool } from '@opencode-ai/plugin'

import { gracefulKill, validateWorkdir } from '../lib/shell'
// Import for internal use
import { matchCommand, validateConstraints } from './sh/index'

export default tool({
  description: 'Execute shell commands (timeout is in milliseconds)',
  args: {
    command: tool.schema.string().describe('The shell command to execute (use relative paths)'),
    workdir: tool.schema.string().describe('Working directory for command execution'),
    timeout: tool.schema.number().describe('Timeout in milliseconds'),
  },
  async execute(args) {
    const { command, workdir, timeout } = args

    if (timeout < 1000) {
      return 'Error: Timeout has to be more than 1s (1000ms)'
    }

    // Check permissions
    const match = matchCommand(command)

    if (match.decision === 'deny') {
      // Standardized error format
      const reason = match.reason ?? 'Command not in allowlist'
      const patternInfo = match.pattern ? `\nPattern: ${match.pattern}` : ''
      return `Error: Command denied\nReason: ${reason}${patternInfo}\n\nCommand: ${command}`
    }

    // Check constraints for allowed commands
    if (match.rule) {
      const effectiveWorkdir = workdir ?? process.cwd()

      // Validate workdir is under cwd
      try {
        validateWorkdir(effectiveWorkdir)
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }

      const constraintResult = validateConstraints(command, effectiveWorkdir, match.rule)

      if (!constraintResult.valid) {
        // Standardized error format - violation message already includes "Command denied:"
        const reasonInfo = match.reason ? `\nReason: ${match.reason}` : ''
        return `Error: ${constraintResult.violation}\nPattern: ${match.pattern}${reasonInfo}\n\nCommand: ${command}`
      }
    }

    try {
      // Execute the command
      const proc = Bun.spawn(['sh', '-c', command], {
        cwd: workdir ?? process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Handle timeout with proper cleanup
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        gracefulKill(proc)
      }, timeout)

      // Wait for completion
      const exitCode = await proc.exited
      clearTimeout(timeoutId)

      // Read output
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      // Handle timeout case
      if (timedOut) {
        return `Error: Command timed out after ${timeout}ms and was terminated\n\nCommand: ${command}`
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
        output = `Command exited with code ${exitCode}\n${output}`
      }

      return output || '(no output)'
    } catch (error) {
      return `Error: Command execution failed: ${error instanceof Error ? error.message : String(error)}\n\nCommand: ${command}`
    }
  },
})
