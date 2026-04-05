import type { PluginToolDefinition } from './types'

export const NODE_TOOL: PluginToolDefinition = {
  kind: 'plugin',
  permission: { node: 'allow' },
  prompt: `## node (JavaScript/TypeScript sandbox)
- Execute JS/TS code in an isolated sandbox container
- No network access, 512MB RAM, 1 CPU
- No access to local filesystem — paste in data you want to work with
- Fresh container per execution (parallel-safe)
- Can preinstall npm packages`,
  instructions: `## node (JavaScript/TypeScript sandbox)
- Isolated containers: no network, 512MB RAM, 1 CPU
- No access to local filesystem, paste in data you want to work with
- **NEVER manually create ASCII art, diagrams, graphs, charts, or tables** — LLMs are bad at this
  - ALWAYS use code with a library (e.g., \`figlet\`, \`asciichart\`, \`cli-table3\`, \`ascii-art\`, \`terminal-kit\`)
  - If you don't know a suitable package, research one first (npm search, etc.)
  - Execute the code and return its output verbatim — do not modify, augment, or "fix" the result
  - No manual axes, legends, titles, or decorations — let the library handle it or omit them
  - **Trust the tool output** — it is NOT corrupted. If it looks wrong, that's how it renders. Do not "fix" or redraw it manually.
  - If the library fails or produces unusable output, say so and move on — do NOT attempt a manual version`,
}

export const PYTHON_TOOL: PluginToolDefinition = {
  kind: 'plugin',
  permission: { python: 'allow' },
  prompt: `## python (Python sandbox)
- Execute Python code in an isolated sandbox container
- No network access, 512MB RAM, 1 CPU
- No access to local filesystem — paste in data you want to work with
- Fresh container per execution (parallel-safe)
- Can preinstall pip packages`,
  instructions: `## python (Python sandbox)
- Isolated containers: no network, 512MB RAM, 1 CPU
- No access to local filesystem, paste in data you want to work with
- **NEVER manually create ASCII art, diagrams, graphs, charts, or tables** — LLMs are bad at this
  - ALWAYS use code with a library (e.g., \`art\`, \`asciichartpy\`, \`tabulate\`, \`rich\`)
  - If you don't know a suitable package, research one first (pypi, etc.)
  - Execute the code and return its output verbatim — do not modify, augment, or "fix" the result
  - No manual axes, legends, titles, or decorations — let the library handle it or omit them
  - **Trust the tool output** — it is NOT corrupted. If it looks wrong, that's how it renders. Do not "fix" or redraw it manually.
  - If the library fails or produces unusable output, say so and move on — do NOT attempt a manual version`,
}

export const TESSERACT_TOOL: PluginToolDefinition = {
  kind: 'plugin',
  permission: { tesseract: 'allow' },
  prompt: `## tesseract (OCR)
- Perform OCR (Optical Character Recognition) on images using Tesseract
- Reads image files from the local filesystem (PNG, JPEG, TIFF, BMP, GIF)
- Supports 100+ languages
- Multiple output formats: plain text, hOCR, ALTO XML, PDF, TSV
- Maximum file size: 10MB`,
}

export const TIME_TOOL: PluginToolDefinition = {
  kind: 'plugin',
  permission: { time: 'allow' },
  prompt: `## time (time & timezone)
- Get current time in any timezone
- Convert time between timezones
- Uses IANA timezone names (e.g., 'America/New_York', 'Europe/London')
- Use 'UTC' as default if no timezone is specified`,
  instructions: `## time
- Use time to get and manipulate time and time zones`,
}
