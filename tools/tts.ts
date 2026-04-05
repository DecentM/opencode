/**
 * PocketTTS text-to-speech tool with direct process spawning.
 * Converts text to speech using the pocket-tts CLI.
 * Each execution spawns a fresh process.
 * Supports parallel executions.
 */

import { existsSync } from 'node:fs'
import { extname } from 'node:path'

import { tool } from '@opencode-ai/plugin'
import { formatErrorResult, formatExecutionResult } from '../lib/format'

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000

/** Supported audio file extension for TTS output (WAV only) */
const SUPPORTED_EXTENSION = '.wav'

// =============================================================================
// Main Tool
// =============================================================================

export default tool({
  description: `Convert text to speech using pocket-tts (Kyutai Labs TTS models).

Features:
- Generate natural-sounding speech from text
- Supports multiple voices by name (e.g., 'af', 'af_bella', 'af_sarah', 'am_adam', 'am_michael', 'bf_emma', 'bm_george')
- WAV audio output format only
- Fresh process per execution (parallel-safe)

Required Parameters:
- text: The text content to convert to speech
- output_path: Absolute file path where the audio file will be saved

Optional Parameters:
- voice: Voice name identifier (default: model's default voice)
- timeout: Maximum execution time in milliseconds, default 30 seconds

Supported Output Format:
- .wav: WAV audio format only

Example usage:
  pocket-tts generate --text "Hello world" --output-path /tmp/speech.wav --voice af

The tool spawns a fresh pocket-tts process for each call, ensuring parallel-safe
execution without resource contention between concurrent TTS operations.`,
  args: {
    text: tool.schema.string().describe('Text content to convert to speech. Must not be empty.'),
    output_path: tool.schema
      .string()
      .describe(
        'Absolute path where the audio file will be saved (e.g., /tmp/output.wav). Must use .wav extension.'
      ),
    voice: tool.schema
      .string()
      .optional()
      .describe('Voice name to use (e.g., "af", "af_bella", "am_adam", "bf_emma"). Optional.'),
    timeout: tool.schema
      .number()
      .optional()
      .describe(`Timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}`),
  },
  async execute(args) {
    const { text, output_path, voice, timeout = DEFAULT_TIMEOUT_MS } = args

    // Validate that text is provided and not empty
    if (!text || !text.trim()) {
      return formatErrorResult('Error: No text provided for TTS conversion', 0, 'pocket-tts')
    }

    const trimmedText = text.trim()

    // Validate that output path is provided
    if (!output_path || !output_path.trim()) {
      return formatErrorResult('Error: No output path provided for audio file', 0, 'pocket-tts')
    }

    const trimmedOutputPath = output_path.trim()

    // Validate output file extension (WAV only)
    const ext = extname(trimmedOutputPath).toLowerCase()
    if (ext !== SUPPORTED_EXTENSION) {
      return formatErrorResult(
        `Error: Unsupported file extension "${ext}". Only WAV format (.wav) is supported.`,
        0,
        'pocket-tts'
      )
    }

    // Check if output directory exists (we don't create directories)
    const outputDir = trimmedOutputPath.substring(0, trimmedOutputPath.lastIndexOf('/')) || '/'
    if (outputDir !== '/' && !existsSync(outputDir)) {
      return formatErrorResult(
        `Error: Output directory does not exist: ${outputDir}`,
        0,
        'pocket-tts'
      )
    }

    // Build pocket-tts command arguments
    // pocket-tts generate --text "Hello world" --output-path /path/to/output.wav [--voice af]
    const cmdArgs: string[] = [
      'generate',
      '--text',
      trimmedText,
      '--output-path',
      trimmedOutputPath,
    ]

    if (voice !== undefined && voice.trim()) {
      cmdArgs.push('--voice', voice.trim())
    }

    const startTime = performance.now()
    let timedOut = false

    const proc = Bun.spawn(['pocket-tts', ...cmdArgs], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Timeout handling with SIGTERM/SIGKILL cascade
    const timeoutId = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
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

    return formatExecutionResult({
      exitCode: timedOut ? -2 : (proc.exitCode ?? -1),
      stdout: timedOut
        ? `TTS generation timed out after ${timeout}ms and was terminated.\n${stdout}`.trim()
        : stdout,
      stderr: timedOut
        ? `Execution timed out after ${timeout}ms and was terminated.\n${stderr}`.trim()
        : stderr,
      durationMs,
      timedOut,
      runtime: 'pocket-tts',
    })
  },
})
