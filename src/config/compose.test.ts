import { describe, expect, it } from 'bun:test'

import { defaultSettings } from '../settings/defaults'
import type { Settings } from '../settings/types'
import { composeConfig } from './compose'
import type { RuleDefinition } from './rules/index'
// Helper to create a Settings object with all tools/agents enabled
const allEnabledSettings = (): Settings => defaultSettings(['all', 'style'])

// Helper to create settings with specific agent overrides
const settingsWithAgents = (agents: Record<string, boolean>): Settings => {
  const base = allEnabledSettings()
  return {
    ...base,
    toggles: {
      ...base.toggles,
      agents: { ...base.toggles.agents, ...agents },
    },
  }
}

// Helper to create settings with no tools enabled
const noToolsSettings = (): Settings => {
  const base = allEnabledSettings()
  return {
    ...base,
    toggles: {
      ...base.toggles,
      mcpTools: Object.fromEntries(Object.keys(base.toggles.mcpTools).map((k) => [k, false])),
      pluginTools: Object.fromEntries(Object.keys(base.toggles.pluginTools).map((k) => [k, false])),
    },
  }
}

// Helper to create RuleDefinition[] from names
const makeRules = (...names: string[]): RuleDefinition[] =>
  names.map((name) => ({ name, content: `# ${name} rule content` }))

describe('composeConfig', () => {
  it('returns a valid config object with all static fields', () => {
    const { config } = composeConfig(allEnabledSettings(), [])

    expect(config.$schema).toBe('https://opencode.ai/config.json')
    expect(config.autoupdate).toBe(false)
    expect(config.snapshot).toBe(true)
    expect(config.logLevel).toBe('WARN')
    expect(config.default_agent).toBe('coordinator')
    expect(config.share).toBe('disabled')
  })

  it('includes static disabled agents', () => {
    const { config } = composeConfig(allEnabledSettings(), [])

    expect(config.agent.general).toEqual({ disable: true })
    expect(config.agent.summary).toEqual({ disable: true })
    expect(config.agent.writer).toEqual({ disable: true })
    expect(config.agent.plan).toEqual({ disable: true })
    expect(config.agent.build).toEqual({ disable: true })
  })

  it('includes dynamic agents from loadAgents', () => {
    const { config } = composeConfig(allEnabledSettings(), [])

    // Dynamic agents should be present
    expect(config.agent.coordinator).toBeDefined()
    expect(config.agent.coder).toBeDefined()
    expect(config.agent.explore).toBeDefined()
    // Static agents still present
    expect(config.agent.general).toEqual({ disable: true })
  })

  it('dynamic agents can be disabled via settings', () => {
    const settings = settingsWithAgents({ coder: false })
    const { config } = composeConfig(settings, [])

    expect(config.agent.coder).toEqual({ disable: true })
    // Others still loaded
    expect('disable' in config.agent.coordinator).toBe(false)
  })

  it('builds MCPs from settings toggles', () => {
    const { config } = composeConfig(allEnabledSettings(), [])

    // time is now a plugin tool, not an MCP
    expect(config.mcp.time).toBeUndefined()
    // MCP tools are still present
    expect(config.mcp.github).toBeDefined()
    expect(config.mcp.github.type).toBe('remote')
  })

  it('returns empty mcp when no MCP tools are enabled', () => {
    const { config } = composeConfig(noToolsSettings(), [])

    expect(Object.keys(config.mcp)).toEqual([])
  })

  it('instructions only contains project-level entries', () => {
    const { config } = composeConfig(allEnabledSettings(), makeRules('all', 'style'))

    expect(config.instructions).toEqual([
      '{env:PWD}/AGENTS.md',
      '{env:PWD}/.cursor/rules/*.{md,mdx}',
    ])
  })

  it('includes permission and watcher config', () => {
    const { config } = composeConfig(allEnabledSettings(), [])

    expect(config.permission).toEqual({
      '*': 'deny',
      todoread: 'allow',
      todowrite: 'allow',
    })

    expect(config.watcher.ignore).toEqual(['node_modules/**', 'dist/**', '.git/**'])
  })

  it('produces valid JSON when serialized', () => {
    const { config } = composeConfig(allEnabledSettings(), makeRules('all'))
    const json = JSON.stringify(config)

    // Should not throw
    const parsed = JSON.parse(json)
    expect(parsed.$schema).toBe('https://opencode.ai/config.json')
    expect(parsed.agent.coordinator).toBeDefined()
  })

  it('agent prompts are file references not inline strings', () => {
    const { config } = composeConfig(allEnabledSettings(), [])
    const coordinator = config.agent.coordinator as { prompt: string }
    expect(coordinator.prompt).toBe('{file:./agents/coordinator.md}')
  })

  it('agentPrompts contains inline prompt strings', () => {
    const { agentPrompts } = composeConfig(allEnabledSettings(), [])
    expect(typeof agentPrompts['coordinator']).toBe('string')
    expect(agentPrompts['coordinator'].length).toBeGreaterThan(0)
    // Disabled agents are not in agentPrompts
    expect(agentPrompts['general']).toBeUndefined()
  })
})
