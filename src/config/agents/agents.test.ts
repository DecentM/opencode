import { describe, expect, it } from 'bun:test'

import { defaultSettings } from '../../settings/defaults'
import type { Settings } from '../../settings/types'
import { ALL_TOOLS } from '../tools'
import { mergePermissions } from '../utils'
import { AGENT_DEFINITIONS } from './definitions'
import { buildAgent, loadAgents } from './index'
import type { DynamicPromptContext } from './types'

// Helper to create a Settings object with all tools/agents enabled
const allEnabledSettings = (): Settings => defaultSettings(['all', 'style'])

// Helper to create a DynamicPromptContext with sensible defaults
const makeCtx = (overrides?: Partial<DynamicPromptContext>): DynamicPromptContext => ({
  enabledAgents: AGENT_DEFINITIONS,
  enabledToolNames: Object.keys(ALL_TOOLS),
  ruleContents: [],
  ...overrides,
})

// Helper to create settings with specific overrides
const settingsWith = (
  overrides: Partial<{
    agents: Record<string, boolean>
    mcpTools: Record<string, boolean>
    pluginTools: Record<string, boolean>
  }>
): Settings => {
  const base = allEnabledSettings()
  return {
    ...base,
    toggles: {
      ...base.toggles,
      ...(overrides.agents ? { agents: { ...base.toggles.agents, ...overrides.agents } } : {}),
      ...(overrides.mcpTools
        ? { mcpTools: { ...base.toggles.mcpTools, ...overrides.mcpTools } }
        : {}),
      ...(overrides.pluginTools
        ? { pluginTools: { ...base.toggles.pluginTools, ...overrides.pluginTools } }
        : {}),
      rules: base.toggles.rules,
    },
  }
}

// --- mergePermissions ---

describe('mergePermissions', () => {
  it('merges flat permission entries', () => {
    const base = { glob: 'allow' as const, grep: 'allow' as const }
    const override = { sh: 'allow' as const }
    const result = mergePermissions(base, override)

    expect(result).toEqual({ glob: 'allow', grep: 'allow', sh: 'allow' })
  })

  it('override wins on conflict for flat values', () => {
    const base = { sh: 'deny' as const }
    const override = { sh: 'allow' as const }
    const result = mergePermissions(base, override)

    expect(result).toEqual({ sh: 'allow' })
  })

  it('deep merges nested permission objects', () => {
    const base = {
      read: { '*': 'allow' as const, '.env': 'deny' as const },
    }
    const override = {
      read: { '.secret': 'deny' as const },
    }
    const result = mergePermissions(base, override)

    expect(result).toEqual({
      read: { '*': 'allow', '.env': 'deny', '.secret': 'deny' },
    })
  })

  it('override replaces flat value with nested object', () => {
    const base = { read: 'allow' as const }
    const override = {
      read: { '*': 'allow' as const, '.env': 'deny' as const },
    }
    const result = mergePermissions(base, override)

    expect(result).toEqual({
      read: { '*': 'allow', '.env': 'deny' },
    })
  })

  it('returns copy, does not mutate base', () => {
    const base = { glob: 'allow' as const }
    const override = { sh: 'allow' as const }
    const result = mergePermissions(base, override)

    expect(result).not.toBe(base)
    expect(base).toEqual({ glob: 'allow' })
  })
})

// --- buildAgent ---

describe('buildAgent', () => {
  const coderDef = AGENT_DEFINITIONS.find((d) => d.name === 'coder')
  if (!coderDef) throw new Error('coder agent definition not found')

  it('includes tool permissions when tools are enabled', () => {
    const settings = allEnabledSettings()
    const agent = buildAgent(coderDef, settings, makeCtx())

    // github is an MCP tool — enabled in settings
    expect(agent.permission['github_*']).toBe('allow')
    // figma is an MCP tool — enabled in settings
    expect(agent.permission['figma_*']).toBe('allow')
    // sentry is an MCP tool — enabled in settings
    expect(agent.permission['sentry_*']).toBe('allow')
  })

  it('excludes disabled MCP tool permissions', () => {
    const settings = settingsWith({
      mcpTools: { github: false, figma: false, sentry: false },
    })
    const agent = buildAgent(coderDef, settings, makeCtx())

    // Plugin tools still present
    expect(agent.permission.node).toBe('allow')
    // MCP tools absent
    expect(agent.permission['github_*']).toBeUndefined()
    expect(agent.permission['figma_*']).toBeUndefined()
    expect(agent.permission['sentry_*']).toBeUndefined()
  })

  it('includes tool prompt snippets for enabled tools', () => {
    const settings = allEnabledSettings()
    const agent = buildAgent(coderDef, settings, makeCtx())

    expect(agent.prompt).toContain('## Available Tools')
    expect(agent.prompt).toContain('## node (JavaScript/TypeScript sandbox)')
    expect(agent.prompt).toContain('## github (repository access)')
  })

  it('excludes tool prompt snippets for disabled tools', () => {
    const settings = settingsWith({ mcpTools: { github: false } })
    const agent = buildAgent(coderDef, settings, makeCtx())

    expect(agent.prompt).toContain('## node (JavaScript/TypeScript sandbox)')
    expect(agent.prompt).not.toContain('## github (repository access)')
  })

  it('preserves base permission entries', () => {
    const settings = allEnabledSettings()
    const agent = buildAgent(coderDef, settings, makeCtx())

    expect(agent.permission.glob).toBe('allow')
    expect(agent.permission.grep).toBe('allow')
    expect(agent.permission.lsp).toBe('allow')
    expect(agent.permission.codesearch).toBe('allow')
  })

  it('preserves agent metadata', () => {
    const settings = allEnabledSettings()
    const agent = buildAgent(coderDef, settings, makeCtx())

    expect(agent.description).toBe(coderDef.description)
    expect(agent.model).toBe(coderDef.model)
    expect(agent.mode).toBe(coderDef.mode)
    expect(agent.temperature).toBe(coderDef.temperature)
  })

  it('preserves hidden field when present', () => {
    const compactionDef = AGENT_DEFINITIONS.find((d) => d.name === 'compaction')
    if (!compactionDef) throw new Error('compaction agent definition not found')
    const settings = allEnabledSettings()
    const agent = buildAgent(compactionDef, settings, makeCtx())

    expect(agent.hidden).toBe(true)
  })

  it('does not include hidden field when absent', () => {
    const settings = allEnabledSettings()
    const agent = buildAgent(coderDef, settings, makeCtx())

    expect('hidden' in agent).toBe(false)
  })

  it('compaction agent has no tool prompts section', () => {
    const compactionDef = AGENT_DEFINITIONS.find((d) => d.name === 'compaction')
    if (!compactionDef) throw new Error('compaction agent definition not found')
    const settings = allEnabledSettings()
    const agent = buildAgent(compactionDef, settings, makeCtx())

    expect(agent.prompt).not.toContain('## Available Tools')
  })
})

// --- loadAgents ---

describe('loadAgents', () => {
  it('loads all 23 agents when none are disabled', () => {
    const settings = allEnabledSettings()
    const agents = loadAgents(settings, [])

    expect(Object.keys(agents).length).toBe(23)
  })

  it('coordinator is always loaded', () => {
    const settings = allEnabledSettings()
    const agents = loadAgents(settings, [])

    expect(agents.coordinator).toBeDefined()
    expect('disable' in agents.coordinator).toBe(false)
  })

  it('disables agents when toggle is false', () => {
    const settings = settingsWith({
      agents: { coder: false, architect: false },
    })
    const agents = loadAgents(settings, [])

    expect(agents.coder).toEqual({ disable: true })
    expect(agents.architect).toEqual({ disable: true })
    expect('disable' in agents.coordinator).toBe(false)
  })

  it('disables hyphenated agent names correctly', () => {
    const settings = settingsWith({
      agents: { 'personal-assistant': false },
    })
    const agents = loadAgents(settings, [])

    expect(agents['personal-assistant']).toEqual({ disable: true })
  })

  it('treats missing toggle entries as enabled (default true)', () => {
    // Create settings with empty agents toggles — should default to enabled
    const settings: Settings = {
      ...allEnabledSettings(),
      toggles: {
        ...allEnabledSettings().toggles,
        agents: {},
      },
    }
    const agents = loadAgents(settings, [])

    for (const [_name, config] of Object.entries(agents)) {
      expect('disable' in config).toBe(false)
    }
  })

  it('coder agent has correct metadata', () => {
    const settings = allEnabledSettings()
    const agents = loadAgents(settings, [])
    const coder = agents.coder as {
      description: string
      model: string
      mode: string
      temperature: number
      permission: Record<string, unknown>
      prompt: string
    }

    expect(coder.description).toBe(
      'Full-stack developer for implementing features, debugging, testing, refactoring, and performance optimization'
    )
    expect(coder.model).toBe('anthropic/claude-opus-4-6')
    expect(coder.mode).toBe('subagent')
    expect(coder.temperature).toBe(0.2)
    expect(coder.permission).toBeDefined()
    expect(coder.prompt).toContain('senior software engineer')
  })

  it('preserves hidden field when present', () => {
    const settings = allEnabledSettings()
    const agents = loadAgents(settings, [])
    const compaction = agents.compaction as { hidden?: boolean }

    expect(compaction.hidden).toBe(true)
  })

  it('does not include hidden field when absent', () => {
    const settings = allEnabledSettings()
    const agents = loadAgents(settings, [])
    const coder = agents.coder as { hidden?: boolean }

    expect('hidden' in coder).toBe(false)
  })
})

// --- AGENT_DEFINITIONS ---

describe('AGENT_DEFINITIONS', () => {
  it('has 23 agent definitions', () => {
    expect(AGENT_DEFINITIONS.length).toBe(23)
  })

  it('all definitions have unique names', () => {
    const names = AGENT_DEFINITIONS.map((d) => d.name)
    const uniqueNames = new Set(names)

    expect(uniqueNames.size).toBe(names.length)
  })

  it('all definitions have non-empty basePrompt', () => {
    for (const def of AGENT_DEFINITIONS) {
      expect(def.basePrompt.length).toBeGreaterThan(0)
    }
  })

  it('all tool references in definitions exist in ALL_TOOLS', () => {
    for (const def of AGENT_DEFINITIONS) {
      for (const toolName of def.tools) {
        expect(ALL_TOOLS[toolName]).toBeDefined()
      }
    }
  })
})

// --- Coordinator dynamic prompt ---

describe('coordinator dynamic prompt', () => {
  const coordinatorDef = AGENT_DEFINITIONS.find((d) => d.name === 'coordinator')
  if (!coordinatorDef) throw new Error('coordinator agent definition not found')

  it('includes enabled agent names', () => {
    const settings = allEnabledSettings()
    const enabledSubset = AGENT_DEFINITIONS.filter(
      (d) =>
        d.name === 'coder' ||
        d.name === 'reviewer' ||
        d.name === 'coordinator' ||
        d.name === 'compaction'
    )
    const ctx = makeCtx({ enabledAgents: enabledSubset })
    const agent = buildAgent(coordinatorDef, settings, ctx)

    expect(agent.prompt).toContain('**coder**')
    expect(agent.prompt).toContain('**reviewer**')
  })

  it('excludes disabled agent names', () => {
    const settings = settingsWith({ agents: { coder: false } })
    const enabledAgents = AGENT_DEFINITIONS.filter((d) => d.name !== 'coder')
    const ctx = makeCtx({ enabledAgents })
    const agent = buildAgent(coordinatorDef, settings, ctx)

    // coder should not appear in the delegation table rows
    expect(agent.prompt).not.toContain('| **coder** |')
  })

  it('includes inlined rules', () => {
    const settings = allEnabledSettings()
    const ctx = makeCtx({ ruleContents: ['# Rule One\nsome content'] })
    const agent = buildAgent(coordinatorDef, settings, ctx)

    expect(agent.prompt).toContain('# Rule One')
    expect(agent.prompt).toContain('some content')
  })

  it('has no Rules section when ruleContents is empty', () => {
    const settings = allEnabledSettings()
    const ctx = makeCtx({ ruleContents: [] })
    const agent = buildAgent(coordinatorDef, settings, ctx)

    expect(agent.prompt).not.toContain('# Rules')
  })
})
