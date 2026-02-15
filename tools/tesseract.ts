/**
 * Tesseract OCR tool with isolated Docker sandbox.
 * Performs optical character recognition on images using Tesseract.
 * Each execution spawns a fresh container that auto-removes after use.
 * Supports parallel executions with resource isolation.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

import { tool } from '@opencode-ai/plugin'
import { buildImage, formatErrorResult, formatExecutionResult, runContainer } from '../lib/docker'

// =============================================================================
// Constants
// =============================================================================

const OPENCODE_CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR

if (!OPENCODE_CONFIG_DIR) {
  throw new Error(
    `[Tesseract plugin]: Environment variable "OPENCODE_CONFIG_DIR" is not defined. Cannot start.`
  )
}

const DOCKER_CONTEXT = join(OPENCODE_CONFIG_DIR, 'docker')
const DOCKERFILE_PATH = 'tool-tesseract.dockerfile'
const MAX_MEM_MB = 512
const MAX_CPU = 1
const DEFAULT_TIMEOUT_MS = 30000
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

/** Supported image file extensions for OCR */
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif'])

// =============================================================================
// Main Tool
// =============================================================================

export default tool({
  description: `Perform OCR (Optical Character Recognition) on images using Tesseract in an isolated sandbox container.

Features:
- Extracts text from images (PNG, JPEG, TIFF, BMP, GIF)
- Reads image files from the local filesystem
- Supports 100+ languages (install via languages_to_install)
- Multiple output formats: plain text, hOCR, ALTO XML, PDF, TSV
- Configurable page segmentation modes for different document types
- Fresh container per execution (parallel-safe)
- Auto-removes after completion
- Network isolated, memory/CPU limited

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
        'Languages to install in the container build (e.g., "eng+fra+deu"). If not specified, uses the language parameter.'
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
      languages_to_install,
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

    // Read file and convert to base64
    let imageBase64: string
    try {
      const fileBuffer = readFileSync(trimmedPath)
      imageBase64 = fileBuffer.toString('base64')
    } catch (err) {
      return formatErrorResult(
        `Error: Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
        0,
        'tesseract'
      )
    }

    // Determine which languages to install in the container
    // If languages_to_install is specified, use it; otherwise use the language parameter
    const languagesToBuild = languages_to_install ?? language

    // Build the image with the requested language packs
    const buildResult = await buildImage(DOCKER_CONTEXT, {
      dockerfile: DOCKERFILE_PATH,
      quiet: true,
      buildArgs: {
        TESSERACT_LANGUAGES: languagesToBuild,
      },
    })

    if (!buildResult.success || !buildResult.data) {
      return formatErrorResult(
        buildResult.error ?? 'Failed to build Tesseract image',
        0,
        'tesseract'
      )
    }

    // Build the options object for the recognize function
    // Only include options that are explicitly defined
    const optionsParts: string[] = []
    optionsParts.push(`language: '${language}'`)
    optionsParts.push(`output: '${output}'`)
    if (psm !== undefined) {
      optionsParts.push(`psm: ${psm}`)
    }
    if (oem !== undefined) {
      optionsParts.push(`oem: ${oem}`)
    }
    const optionsString = `{ ${optionsParts.join(', ')} }`

    // Generate the JavaScript code to execute in the container
    // The code:
    // 1. Imports the recognize function from tesseractocr
    // 2. Decodes the base64 image data into a Buffer
    // 3. Calls recognize with the buffer and options
    // 4. Outputs the result to stdout
    const code = `
import { recognize } from 'tesseractocr';

try {
  // Decode base64 image data into a Buffer
  const imageBuffer = Buffer.from('${imageBase64}', 'base64');

  // Configure OCR options
  const options = ${optionsString};

  // Perform OCR recognition
  const result = await recognize(imageBuffer, options);

  // Output the result
  console.log(result);
} catch (error) {
  console.error('OCR Error:', error.message || error);
  process.exit(1);
}
`.trim()

    // Run the container with the generated code
    const result = await runContainer({
      image: buildResult.data,
      code,
      cmd: ['-'],
      timeout,
      memory: `${MAX_MEM_MB}m`,
      cpus: MAX_CPU,
      networkMode: 'none',
    })

    // Format and return the result
    return formatExecutionResult({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    })
  },
})
