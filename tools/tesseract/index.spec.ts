/**
 * Tests for the Tesseract OCR tool.
 * Tests tool structure, validation, and full OCR functionality with Docker.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import tesseractTool from '../tesseract'

// Mock context required by tool execute - type assertion to bypass strict typing
const mockContext = {
  signal: new AbortController().signal,
  sessionID: 'test-session',
  messageID: 'test-message',
  agent: 'test-agent',
  abort: new AbortController().signal,
  permissions: {},
  info: () => {},
  metadata: () => {},
  ask: async () => ({}),
} as unknown as Parameters<typeof tesseractTool.execute>[1]

// =============================================================================
// Test Fixtures Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), `tesseract-test-${Date.now()}`)

// PNG images with readable text for OCR testing (400x100 white background with black text)
// Generated with Pillow using DejaVuSans font at 60pt
const HELLO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAZAAAABkCAIAAAAnqfEgAAAClUlEQVR4nO3dMU5iURiGYZhMJLG6vTvACqmuWGCkZCuW4BIIkrgDY1iGhYkroNQNuABob8MUZowZnGRwRPj0ebpzAuSv3pxzGurL5bIGkODHtgcA+FeCBcQQLCCGYAExBAuIIVhADMECYggWEEOwgBiCBcQQLCCGYAExBAuIIVhADMECYggWEGN3g1UUxZvL/f397m9XV1ern3xz5+bmpt1ul2XZbren0+lGJgY27Oe2B1jb3t7e/f39Wl+5vb29vr6+u7srimI+n/f7/YODg16vt5kBgU3Z3RPWB5pMJpPJ5PnYVRTF5eXleDze9lDA2r5FsB4fH1ut1svy6Ojo4eFhi/MA77O7V8Kqqrrd7uvl6v5oNCrLct1fXi6X9Xr9A0YEPtfuBuuPt6qXd/R3vGE1m83ZbHZ8fPy8nM1mh4eHHzIk8Jm+xZVwMBgMh8PFYlGr1ebz+cXFxXA43PZQwNp294T1N6+vhGVZjkajqqpOTk6edzqdzng8Xt15eno6PT1tNBpVVZ2fn5+dnW1leOB/1P2RKpDiW1wJga9BsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYggXEECwghmABMQQLiCFYQAzBAmIIFhBDsIAYvwAmP2wbPvFHbAAAAABJRU5ErkJggg=='

const WORLD_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAZAAAABkCAIAAAAnqfEgAAAEIUlEQVR4nO3dT0tUaxzA8efcJoMkmp1Eq1aJWpEi2Jg2ZrUIaeeqjat2QQU59BLUVS8gynW9gYJAF8XMFAZGf6hwU7bNkBRnormL4YbUpeJerfnB57M6zHmec55n8+Wcs5ms0WgkgAj++tMLAPhVggWEIVhAGIIFhCFYQBiCBYQhWEAYggWEIVhAGIIFhCFYQBiCBYQhWEAYggWEIVhAGIIFhNGiwZqYmLh9+3bz+MiRI5cvX24eX7p06c6dOymlmzdv9vX1HTt2rK+vb3Z2tnl29+7dxWLxxIkTvb298/PzKaV8Pv/NlZtjRkZGBgcHb9269Vt2A2yN3J9ewL8rFAqPHj0aHx9fXV3N5XKVSqX5e6VSuXbt2t27d2/cuHH//v18Pr+ysjI2NrZ///5Tp061tbXNzc2llJ4+fXr+/PnFxcXvr/x1zKdPn86dO9fe3j4+Pv77Ngb8Dy36hFUoFB4/fpxSKpfLZ8+eXVtb29jYqNfra2trHR0dMzMzMzMzzaenfD4/PT09NTW1eXpPT8/y8vKPb9He3j49PX39+vVt2wSwxVr0Cau7u3tpaanRaDx8+HBoaOj9+/dPnjzZsWNHf39/SunFixdHjx79Ori3t/f58+ebp9+7d+/kyZM/vcvhw4ffvHmz5YsHtkmLBivLss7OzlevXlWr1StXrrx9+7ZcLudyueHh4e8HNxqNLMtSSrVarVgs1uv1ly9fPnv27Kd3+fz5886dO7d+9cD2aNFXwpRSoVCoVqvr6+t79uwpFArlcrlSqQwNDaWUurq6FhYWvo5cWFjo7u5O/3yfevDgQalU+pUP6tVq9dChQ9u2A2CLtXSwZmdne3p6UkqdnZ2vX79eXl4+cOBASunq1auTk5MfP35MKa2srJRKpcnJyc1zT58+Xa1Wf3z9Dx8+fD8RaGUt+kqYUhoYGJifn79w4UJKKcuyffv27d27t3nqzJkz7969GxkZ2bVrV61Wu3jx4ujo6Oa5Bw8eXFxc/PLlS61WO378ePPHwcHBqamp5mtjlmX1er1UKhWLxd+7LeC/y/yRKhBF674SAnxDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAwBAsIQ7CAMAQLCEOwgDAECwhDsIAw/gapVfrg/K3tCAAAAABJRU5ErkJggg=='

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })

  // Create test files with readable text for OCR
  writeFileSync(join(TEST_DIR, 'test.png'), Buffer.from(HELLO_PNG_BASE64, 'base64'))
  writeFileSync(join(TEST_DIR, 'test.jpg'), Buffer.from(WORLD_PNG_BASE64, 'base64'))
  writeFileSync(join(TEST_DIR, 'test.txt'), 'not an image')
  writeFileSync(join(TEST_DIR, 'test.unsupported'), 'not an image')
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

// =============================================================================
// Tool Structure Tests
// =============================================================================

describe('Tesseract Tool', () => {
  describe('tool definition', () => {
    test('exports a valid tool object', () => {
      expect(tesseractTool).toBeDefined()
      expect(typeof tesseractTool).toBe('object')
    })

    test('has required tool properties', () => {
      expect(tesseractTool.description).toBeDefined()
      expect(tesseractTool.execute).toBeDefined()
      expect(typeof tesseractTool.execute).toBe('function')
    })

    test('has a description', () => {
      expect(tesseractTool.description).toBeDefined()
      expect(typeof tesseractTool.description).toBe('string')
      expect(tesseractTool.description.length).toBeGreaterThan(0)
    })

    test('description mentions OCR', () => {
      expect(tesseractTool.description.toLowerCase()).toContain('ocr')
    })

    test('description mentions Tesseract', () => {
      expect(tesseractTool.description.toLowerCase()).toContain('tesseract')
    })

    test('description mentions file path', () => {
      expect(tesseractTool.description.toLowerCase()).toContain('file')
    })
  })

  describe('args schema', () => {
    test('has args schema defined', () => {
      expect(tesseractTool.args).toBeDefined()
    })

    test('has file_path parameter', () => {
      expect(tesseractTool.args.file_path).toBeDefined()
    })

    test('has language parameter', () => {
      expect(tesseractTool.args.language).toBeDefined()
    })

    test('has output format parameter', () => {
      expect(tesseractTool.args.output).toBeDefined()
    })

    test('has psm parameter for page segmentation', () => {
      expect(tesseractTool.args.psm).toBeDefined()
    })

    test('has oem parameter for OCR engine mode', () => {
      expect(tesseractTool.args.oem).toBeDefined()
    })

    test('has timeout parameter', () => {
      expect(tesseractTool.args.timeout).toBeDefined()
    })

    test('has languages_to_install parameter', () => {
      expect(tesseractTool.args.languages_to_install).toBeDefined()
    })
  })

  describe('empty input handling', () => {
    test('returns error for empty file_path', async () => {
      const result = await tesseractTool.execute(
        {
          file_path: '',
        },
        mockContext
      )

      expect(result).toContain('No file path provided')
    })

    test('returns error for whitespace-only file_path', async () => {
      const result = await tesseractTool.execute(
        {
          file_path: '   ',
        },
        mockContext
      )

      expect(result).toContain('No file path provided')
    })
  })

  describe('file validation', () => {
    test('returns error for non-existent file', async () => {
      const result = await tesseractTool.execute(
        {
          file_path: '/nonexistent/path/image.png',
        },
        mockContext
      )

      expect(result).toContain('File not found')
    })

    test('returns error for unsupported file extension', async () => {
      const result = await tesseractTool.execute(
        {
          file_path: join(TEST_DIR, 'test.unsupported'),
        },
        mockContext
      )

      expect(result).toContain('Unsupported file extension')
    })

    test('returns error for .txt extension', async () => {
      const result = await tesseractTool.execute(
        {
          file_path: join(TEST_DIR, 'test.txt'),
        },
        mockContext
      )

      expect(result).toContain('Unsupported file extension')
    })

    // Note: These tests require Docker daemon to be running.
    // They test the full OCR pipeline with images containing readable text.

    test(
      'performs OCR on .png files and extracts text',
      async () => {
        const result = await tesseractTool.execute(
          {
            file_path: join(TEST_DIR, 'test.png'),
          },
          mockContext
        )

        // Should NOT contain file validation errors
        expect(result).not.toContain('No file path provided')
        expect(result).not.toContain('File not found')
        expect(result).not.toContain('Unsupported file extension')
        expect(result).not.toContain('File too large')

        // Should contain the extracted text "HELLO"
        expect(result.toUpperCase()).toContain('HELLO')
      },
      { timeout: 60000 }
    )

    test(
      'performs OCR on .jpg files and extracts text',
      async () => {
        const result = await tesseractTool.execute(
          {
            file_path: join(TEST_DIR, 'test.jpg'),
          },
          mockContext
        )

        // Should NOT contain file validation errors
        expect(result).not.toContain('No file path provided')
        expect(result).not.toContain('File not found')
        expect(result).not.toContain('Unsupported file extension')

        // Should contain the extracted text "WORLD"
        expect(result.toUpperCase()).toContain('WORLD')
      },
      { timeout: 60000 }
    )
  })
})

// =============================================================================
// Language Code Tests
// =============================================================================

describe('Language support', () => {
  test('description mentions common language codes', () => {
    const desc = tesseractTool.description.toLowerCase()
    expect(desc).toContain('eng')
  })

  test('description mentions page segmentation modes', () => {
    const desc = tesseractTool.description.toLowerCase()
    expect(desc).toContain('psm')
  })
})

// =============================================================================
// Output Format Tests
// =============================================================================

describe('Output formats', () => {
  test('description mentions text output', () => {
    const desc = tesseractTool.description.toLowerCase()
    expect(desc).toContain('text')
  })

  test('description mentions hocr output', () => {
    const desc = tesseractTool.description.toLowerCase()
    expect(desc).toContain('hocr')
  })
})

// =============================================================================
// File Size Tests
// =============================================================================

describe('File size validation', () => {
  test('description mentions 10MB limit', () => {
    expect(tesseractTool.description).toContain('10MB')
  })
})
