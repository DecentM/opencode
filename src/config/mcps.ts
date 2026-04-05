import { ALL_TOOLS } from './tools'
import type { McpToolDefinition } from './tools/types'
import type { McpConfig } from './types'

export const buildMcps = (enabledMcpNames: Set<string>): Record<string, McpConfig> => {
  const result: Record<string, McpConfig> = {}

  for (const [name, tool] of Object.entries(ALL_TOOLS)) {
    if (tool.kind !== 'mcp') continue
    if (!enabledMcpNames.has(name)) continue
    const mcpTool = tool as McpToolDefinition
    result[mcpTool.mcpName] = mcpTool.mcpConfig
  }

  return result
}
