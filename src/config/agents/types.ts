import type { AgentMode, PermissionMap } from '../types'

export type DynamicPromptContext = {
  // All agent definitions that are currently enabled (not disabled by settings)
  enabledAgents: AgentDefinition[]
  // Names of all currently enabled tools (both mcp and plugin)
  enabledToolNames: string[]
  // Contents of enabled rule files, in order (already read from disk)
  ruleContents: string[]
}

// Base agent definition — tools are referenced by name
export type AgentDefinition = {
  name: string
  description: string
  mode: AgentMode
  temperature: number
  hidden?: boolean
  // Tool names from ALL_TOOLS that this agent has access to
  // Enabled tools contribute their permission entries and prompt snippets
  tools: string[]
  // The agent's own base permission map (beyond what tools contribute)
  // e.g. { glob: 'allow', grep: 'allow', list: 'allow', read: { '*': 'allow', '.env': 'deny' } }
  basePermission: PermissionMap
  // The agent's own base prompt (the core identity/instructions)
  // Tool prompt snippets are appended after this
  basePrompt: string
  // Optional: called at build time to generate a dynamic prompt section
  // appended after basePrompt and before tool snippets
  buildDynamicPrompt?: (ctx: DynamicPromptContext) => string
}
