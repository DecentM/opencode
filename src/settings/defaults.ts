import { AGENT_DEFINITIONS } from '../config/agents/definitions'
import { ALL_TOOLS } from '../config/tools'
import type { Settings } from './types'

// All agents enabled by default
const defaultAgents = (): Record<string, boolean> =>
  Object.fromEntries(AGENT_DEFINITIONS.map((d) => [d.name, true]))

// MCP tools: all enabled by default
const defaultMcpTools = (): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(ALL_TOOLS)
      .filter(([, t]) => t.kind === 'mcp')
      .map(([name]) => [name, true])
  )

// Plugin tools: all enabled by default
const defaultPluginTools = (): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(ALL_TOOLS)
      .filter(([, t]) => t.kind === 'plugin')
      .map(([name]) => [name, true])
  )

// Rules: all enabled by default (caller passes rule names)
export const defaultRules = (ruleNames: string[]): Record<string, boolean> =>
  Object.fromEntries(ruleNames.map((name) => [name, true]))

export const defaultSettings = (ruleNames: string[]): Settings => ({
  credentials: {
    MY_NAME: '',
    GITHUB_TOKEN: '',
    FIGMA_TOKEN: '',
    SLACK_MCP_XOXC_TOKEN: '',
    SLACK_MCP_XOXD_TOKEN: '',
    SLACK_MCP_ALLOWED_CHANNELS: '',
  },
  toggles: {
    agents: defaultAgents(),
    mcpTools: defaultMcpTools(),
    pluginTools: defaultPluginTools(),
    rules: defaultRules(ruleNames),
  },
})
