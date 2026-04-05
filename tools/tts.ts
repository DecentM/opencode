/**
 * PocketTTS text-to-speech tool with direct process spawning.
 * Converts text to speech using the pockettts CLI.
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
const DEFAULT_SPEED = 1.0
const MIN_SPEED = 0.5
const MAX_SPEED = 2.0

/** Supported audio file extensions for TTS output */
const SUPPORTED_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg'])

// =============================================================================
// Main Tool
// =============================================================================

export default tool({
  description: `Convert text to speech using pockettts (Kyutai Labs TTS models).

Features:
- Generate natural-sounding speech from text
- Supports multiple languages and voices (e.g., 'en-US', 'en-GB', 'fr-FR', 'de-DE')
- Adjustable speech speed (0.5x to 2.0x)
- Multiple audio output formats: WAV, MP3, OGG
- Fresh process per execution (parallel-safe)

Required Parameters:
- text: The text content to convert to speech
- output_path: Absolute file path where the audio file will be saved

Optional Parameters:
- voice: Voice/language identifier (default: model's default voice)
- speed: Speech speed multiplier from 0.5 (slow) to 2.0 (fast), default 1.0
- timeout: Maximum execution time in milliseconds, default 30 seconds

Supported Output Formats:
- .wav: WAV audio format (recommended for best quality)
- .mp3: MP3 compressed audio
- .ogg: Ogg Vorbis audio format

Example usage:
  pockettts --text "Hello world" --output /tmp/speech.wav --voice en-US --speed 1.0

The tool spawns a fresh pockettts process for each call, ensuring parallel-safe
execution without resource contention between concurrent TTS operations.`,
  args: {
    text: tool.schema.string().describe('Text content to convert to speech. Must not be empty.'),
    output_path: tool.schema
      .string()
      .describe(
        'Absolute path where the audio file will be saved (e.g., /tmp/output.wav). Supported extensions: .wav, .mp3, .ogg'
      ),
    voice: tool.schema
      .string()
      .optional()
      .describe('Voice/language to use (e.g., "en-US", "en-GB", "fr-FR", "de-DE"). Optional.'),
    speed: tool.schema
      .number()
      .optional()
      .describe(
        `Speech speed multiplier from ${MIN_SPEED} (slow) to ${MAX_SPEED} (fast). Default: ${DEFAULT_SPEED}`
      ),
    timeout: tool.schema
      .number()
      .optional()
      .describe(`Timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}`),
  },
  async execute(args) {
    const { text, output_path, voice, speed = DEFAULT_SPEED, timeout = DEFAULT_TIMEOUT_MS } = args

    // Validate that text is provided and not empty
    if (!text || !text.trim()) {
      return formatErrorResult('Error: No text provided for TTS conversion', 0, 'pockettts')
    }

    const trimmedText = text.trim()

    // Validate that output path is provided
    if (!output_path || !output_path.trim()) {
      return formatErrorResult('Error: No output path provided for audio file', 0, 'pockettts')
    }

    const trimmedOutputPath = output_path.trim()

    // Validate output file extension
    const ext = extname(trimmedOutputPath).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return formatErrorResult(
        `Error: Unsupported file extension "${ext}". Supported formats: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
        0,
        'pockettts'
      )
    }

    // Validate speed is within valid range
    if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
      return formatErrorResult(
        `Error: Speed must be a number between ${MIN_SPEED} and ${MAX_SPEED}, got ${speed}`,
        0,
        'pockettts'
      )
    }

    // Check if output directory exists (we don't create directories)
    const outputDir = trimmedOutputPath.substring(0, trimmedOutputPath.lastIndexOf('/')) || '/'
    if (outputDir !== '/' && !existsSync(outputDir)) {
      return formatErrorResult(
        `Error: Output directory does not exist: ${outputDir}`,
        0,
        'pockettts'
      )
    }

    // Build pockettts command arguments
    // pockettts --text "Hello world" --output /path/to/output.wav [--voice en-US] [--speed 1.0]
    const cmdArgs: string[] = ['--text', trimmedText, '--output', trimmedOutputPath]

    if (voice !== undefined && voice.trim()) {
      cmdArgs.push('--voice', voice.trim())
    }

    if (speed !== DEFAULT_SPEED) {
      cmdArgs.push('--speed', String(speed))
    }

    const startTime = performance.now()
    let timedOut = false

    const proc = Bun.spawn(['pockettts', ...cmdArgs], {
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
      runtime: 'pockettts',
    })
  },
})
