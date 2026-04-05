import type { McpConfig, PermissionMap } from '../types'

// A tool that is a custom plugin (node, python, tesseract, time)
// These are loaded via @opencode-ai/plugin and referenced by name in agent permissions
export type PluginToolDefinition = {
  kind: 'plugin'
  // The permission key(s) this tool needs in an agent's permission map
  // e.g. { node: 'allow' } or { python: 'allow' }
  permission: PermissionMap
  // Markdown snippet injected into the agent's prompt when this tool is available
  // Should describe what the tool does and how to use it
  prompt: string
  // Optional global behavioural instructions for this tool, written into the
  // 'all' rule when the tool is enabled. Distinct from prompt (per-agent snippet).
  instructions?: string
}

// A tool that is an MCP server (github, pw, jira, notion, sentry, slack, figma)
export type McpToolDefinition = {
  kind: 'mcp'
  // The MCP server name (key in the mcp config object)
  mcpName: string
  // The MCP server config
  mcpConfig: McpConfig
  // The permission key(s) this tool needs in an agent's permission map
  // e.g. { 'github_*': 'allow' } or { 'pw*': 'allow' }
  permission: PermissionMap
  // Markdown snippet injected into the agent's prompt when this tool is available
  prompt: string
  // Optional global behavioural instructions for this tool, written into the
  // 'all' rule when the tool is enabled. Distinct from prompt (per-agent snippet).
  instructions?: string
}

export type ToolDefinition = PluginToolDefinition | McpToolDefinition

// Whether a tool is enabled given the current settings
export type ToolResolution = {
  tool: ToolDefinition
  enabled: boolean
}
