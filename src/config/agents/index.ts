export * from './types'
export { AGENT_DEFINITIONS } from './definitions'

import type { Settings } from '../../settings/types'
import { resolveTools } from '../tools'
import type { AgentConfig, DisabledAgentConfig } from '../types'
import { mergePermissions } from '../utils'
import { AGENT_DEFINITIONS } from './definitions'
import type { AgentDefinition, DynamicPromptContext } from './types'

// Build a fully resolved AgentConfig from a definition + settings
export const buildAgent = (
  def: AgentDefinition,
  settings: Settings,
  ctx: DynamicPromptContext
): AgentConfig => {
  // Build the set of enabled tool names from settings
  const enabledToolNames = new Set<string>([
    ...Object.entries(settings.toggles.mcpTools)
      .filter(([, v]) => v)
      .map(([k]) => k),
    ...Object.entries(settings.toggles.pluginTools)
      .filter(([, v]) => v)
      .map(([k]) => k),
  ])

  const resolved = resolveTools(def.tools, enabledToolNames)
  const enabledTools = resolved.filter((r) => r.enabled).map((r) => r.tool)

  // Merge base permission with all enabled tool permissions
  const permission = enabledTools.reduce(
    (acc, tool) => mergePermissions(acc, tool.permission),
    def.basePermission
  )

  // Build prompt: basePrompt + optional dynamic section + tool snippets
  const dynamicSection = def.buildDynamicPrompt?.(ctx) ?? ''
  const toolPrompts = enabledTools.map((t) => t.prompt).filter(Boolean)

  let prompt = def.basePrompt
  if (dynamicSection) prompt += `\n\n${dynamicSection}`
  if (toolPrompts.length > 0)
    prompt += `\n\n---\n\n## Available Tools\n\n${toolPrompts.join('\n\n')}`

  return {
    description: def.description,
    model: def.model,
    mode: def.mode,
    temperature: def.temperature,
    ...(def.hidden != null ? { hidden: def.hidden } : {}),
    permission,
    prompt,
  }
}

export const loadAgents = (
  settings: Settings,
  ruleContents: string[]
): Record<string, AgentConfig | DisabledAgentConfig> => {
  // Determine which agents are enabled
  const enabledAgents = AGENT_DEFINITIONS.filter((def) => settings.toggles.agents[def.name] ?? true)

  // Determine which tool names are enabled
  const enabledToolNames = [
    ...Object.entries(settings.toggles.mcpTools)
      .filter(([, v]) => v)
      .map(([k]) => k),
    ...Object.entries(settings.toggles.pluginTools)
      .filter(([, v]) => v)
      .map(([k]) => k),
  ]

  const ctx: DynamicPromptContext = { enabledAgents, enabledToolNames, ruleContents }

  const result: Record<string, AgentConfig | DisabledAgentConfig> = {}
  for (const def of AGENT_DEFINITIONS) {
    const enabled = settings.toggles.agents[def.name] ?? true
    if (!enabled) {
      result[def.name] = { disable: true }
    } else {
      result[def.name] = buildAgent(def, settings, ctx)
    }
  }
  return result
}
