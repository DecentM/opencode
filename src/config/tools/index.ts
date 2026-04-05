export * from './types'
export * from './plugin-tools'
export * from './mcp-tools'

import type { ToolDefinition, ToolResolution } from './types'

import {
  FIGMA_TOOL,
  GITHUB_TOOL,
  JIRA_TOOL,
  NOTION_TOOL,
  PW_TOOL,
  SENTRY_TOOL,
  SLACK_TOOL,
} from './mcp-tools'
import { NODE_TOOL, PYTHON_TOOL, TESSERACT_TOOL, TIME_TOOL } from './plugin-tools'

// All tool definitions keyed by name
export const ALL_TOOLS: Record<string, ToolDefinition> = {
  node: NODE_TOOL,
  python: PYTHON_TOOL,
  tesseract: TESSERACT_TOOL,
  time: TIME_TOOL,
  github: GITHUB_TOOL,
  pw: PW_TOOL,
  jira: JIRA_TOOL,
  notion: NOTION_TOOL,
  sentry: SENTRY_TOOL,
  slack: SLACK_TOOL,
  figma: FIGMA_TOOL,
}

// Resolve which tools are enabled given an explicit set of enabled tool names
export const resolveTools = (
  toolNames: string[],
  enabledToolNames: Set<string>
): ToolResolution[] =>
  toolNames
    .map((name) => ({ name, tool: ALL_TOOLS[name] }))
    .filter((entry): entry is { name: string; tool: ToolDefinition } => entry.tool != null)
    .map(({ name, tool }) => ({
      tool,
      enabled: enabledToolNames.has(name),
    }))
