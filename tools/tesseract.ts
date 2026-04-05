/**
 * Tesseract OCR tool with direct process spawning.
 * Performs optical character recognition on images using the tesseract CLI.
 * Each execution spawns a fresh process.
 * Supports parallel executions.
 */

import { existsSync, statSync } from 'node:fs'
import { extname } from 'node:path'

import { tool } from '@opencode-ai/plugin'
import { formatErrorResult, formatExecutionResult } from '../lib/format'

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

/** Supported image file extensions for OCR */
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif'])

/** Map output format names to tesseract output extensions */
const OUTPUT_FORMAT_MAP: Record<string, string> = {
  txt: 'stdout',
  hocr: 'hocr',
  alto: 'alto',
  pdf: 'pdf',
  tsv: 'tsv',
}

// =============================================================================
// Main Tool
// =============================================================================

export default tool({
  description: `Perform OCR (Optical Character Recognition) on images using Tesseract.

Features:
- Extracts text from images (PNG, JPEG, TIFF, BMP, GIF)
- Reads image files from the local filesystem
- Supports 100+ languages
- Multiple output formats: plain text, hOCR, ALTO XML, PDF, TSV
- Configurable page segmentation modes for different document types
- Fresh process per execution (parallel-safe)

File Requirements:
- Maximum file size: 10MB
- Supported formats: PNG, JPG, JPEG, TIFF, BMP, GIF

Common language codes:
- eng (English), fra (French), deu (German), spa (Spanish)
- chi-sim (Chinese Simplified), chi-tra (Chinese Traditional)
- jpn (Japanese), kor (Korean), ara (Arabic), rus (Russian)

Page Segmentation Modes (psm):
- 0: Orientation and script detection only
- 1: Automatic page segmentation with OSD
- 3: Fully automatic page segmentation (default)
- 6: Assume single uniform block of text
- 7: Treat image as single text line
- 11: Sparse text (find as much text as possible)
- 13: Raw line (treat image as single text line, no Tesseract-specific processing)

Returns extracted text, hOCR, ALTO XML, or other formats based on output parameter.`,
  args: {
    file_path: tool.schema
      .string()
      .describe(
        'Absolute path to the image file on the local filesystem (PNG, JPEG, TIFF, BMP, GIF)'
      ),
    language: tool.schema
      .string()
      .optional()
      .describe('Language code(s) for OCR, can combine with + (e.g., "eng+fra"). Default: "eng"'),
    output: tool.schema
      .string()
      .optional()
      .describe(
        'Output format: txt (plain text), hocr (HTML), alto (XML), pdf, tsv. Default: "txt"'
      ),
    psm: tool.schema
      .number()
      .optional()
      .describe('Page segmentation mode (0-13). Controls how Tesseract segments the image.'),
    oem: tool.schema
      .number()
      .optional()
      .describe(
        'OCR Engine Mode (0-3): 0=Legacy, 1=LSTM, 2=Legacy+LSTM, 3=Default based on availability'
      ),
    timeout: tool.schema
      .number()
      .optional()
      .describe(`Timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}`),
    languages_to_install: tool.schema
      .string()
      .optional()
      .describe(
        'Languages to install (ignored — use system-installed tessdata). If not specified, uses the language parameter.'
      ),
  },
  async execute(args) {
    const {
      file_path,
      language = 'eng',
      output = 'txt',
      psm,
      oem,
      timeout = DEFAULT_TIMEOUT_MS,
    } = args

    // Validate that file path was provided
    if (!file_path || !file_path.trim()) {
      return formatErrorResult('Error: No file path provided', 0, 'tesseract')
    }

    const trimmedPath = file_path.trim()

    // Validate file extension
    const ext = extname(trimmedPath).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return formatErrorResult(
        `Error: Unsupported file extension "${ext}". Supported formats: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
        0,
        'tesseract'
      )
    }

    // Check if file exists
    if (!existsSync(trimmedPath)) {
      return formatErrorResult(`Error: File not found: ${trimmedPath}`, 0, 'tesseract')
    }

    // Check file size
    let fileStats
    try {
      fileStats = statSync(trimmedPath)
    } catch (err) {
      return formatErrorResult(
        `Error: Cannot read file stats: ${err instanceof Error ? err.message : String(err)}`,
        0,
        'tesseract'
      )
    }

    if (fileStats.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2)
      return formatErrorResult(
        `Error: File too large (${sizeMB}MB). Maximum allowed size is 10MB.`,
        0,
        'tesseract'
      )
    }

    // Validate output format
    const tesseractOutput = OUTPUT_FORMAT_MAP[output]
    if (!tesseractOutput) {
      return formatErrorResult(
        `Error: Unsupported output format "${output}". Supported: ${Object.keys(OUTPUT_FORMAT_MAP).join(', ')}`,
        0,
        'tesseract'
      )
    }

    // Build tesseract command arguments
    // tesseract <input> stdout -l <lang> [--psm N] [--oem N] [output_format]
    const cmdArgs: string[] = [trimmedPath, 'stdout', '-l', language]

    if (psm !== undefined) {
      cmdArgs.push('--psm', String(psm))
    }

    if (oem !== undefined) {
      cmdArgs.push('--oem', String(oem))
    }

    // For non-txt formats, append the output config
    if (tesseractOutput !== 'stdout') {
      cmdArgs.push(tesseractOutput)
    }

    const startTime = performance.now()
    let timedOut = false

    const proc = Bun.spawn(['tesseract', ...cmdArgs], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Timeout handling
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
      stdout,
      stderr: timedOut
        ? `Execution timed out after ${timeout}ms and was terminated.\n${stderr}`.trim()
        : stderr,
      durationMs,
      timedOut,
      runtime: 'tesseract',
    })
  },
})
