import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Settings } from '../settings/types'
import { loadAgents } from './agents'
import { buildMcps } from './mcps'
import type { RuleDefinition } from './rules/index'
import type { AgentConfig, AgentOverrideConfig, DisabledAgentConfig, OpencodeConfig } from './types'

export type ComposeResult = {
  config: OpencodeConfig
  agentPrompts: Record<string, string>
}

export type TempConfigResult = {
  tempDir: string
  rulePaths: string[]
}

// Static agents that are always disabled or have fixed config
const STATIC_AGENTS = {
  general: { disable: true as const },
  summary: { disable: true as const },
  title: { model: 'anthropic/claude-haiku-4-5' },
  writer: { disable: true as const },
  plan: { disable: true as const },
  build: { disable: true as const },
}

const isAgentConfig = (
  entry: AgentConfig | DisabledAgentConfig | AgentOverrideConfig
): entry is AgentConfig => {
  return 'prompt' in entry && typeof (entry as AgentConfig).prompt === 'string'
}

export const composeConfig = (settings: Settings, rules: RuleDefinition[]): ComposeResult => {
  const ruleContents = rules.map((r) => r.content)
  const dynamicAgents = loadAgents(settings, ruleContents)
  const enabledMcpNames = new Set(
    Object.entries(settings.toggles.mcpTools)
      .filter(([, v]) => v)
      .map(([k]) => k)
  )
  const mcps = buildMcps(enabledMcpNames)

  const allAgents = {
    ...STATIC_AGENTS,
    ...dynamicAgents,
  }

  // Extract prompts from enabled agents and replace with file references
  const agentPrompts: Record<string, string> = {}
  const agentEntries: Record<string, AgentConfig | DisabledAgentConfig | AgentOverrideConfig> = {}

  for (const [name, entry] of Object.entries(allAgents)) {
    if (isAgentConfig(entry)) {
      agentPrompts[name] = entry.prompt
      agentEntries[name] = { ...entry, prompt: `{file:./agents/${name}.md}` }
    } else {
      agentEntries[name] = entry
    }
  }

  const plugins: string[] = []

  return {
    config: {
      $schema: 'https://opencode.ai/config.json',
      plugin: plugins,
      autoupdate: false,
      snapshot: true,
      logLevel: 'WARN',
      default_agent: 'coordinator',
      watcher: {
        ignore: ['node_modules/**', 'dist/**', '.git/**'],
      },
      share: 'disabled',
      permission: {
        '*': 'deny',
        todoread: 'allow',
        todowrite: 'allow',
      },
      instructions: ['{env:PWD}/AGENTS.md', '{env:PWD}/.cursor/rules/*.{md,mdx}'],
      agent: agentEntries,
      mcp: mcps,
    },
    agentPrompts,
  }
}

export const writeTempConfig = async (
  config: OpencodeConfig,
  agentPrompts: Record<string, string>,
  rules: RuleDefinition[],
): Promise<TempConfigResult> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'opencode-'))
  const agentsDir = join(tempDir, 'agents')

  await mkdir(agentsDir, { recursive: true })

  await Promise.all(
    Object.entries(agentPrompts).map(([name, prompt]) =>
      writeFile(join(agentsDir, `${name}.md`), prompt)
    )
  )

  // Write rules to tempDir/rules/{name}.md
  const rulesSubDir = join(tempDir, 'rules')
  await mkdir(rulesSubDir, { recursive: true })
  const rulePaths: string[] = []
  for (const rule of rules) {
    const rulePath = join(rulesSubDir, `${rule.name}.md`)
    await writeFile(rulePath, rule.content, 'utf8')
    rulePaths.push(rulePath)
  }

  // Prepend rule paths into instructions before writing config
  const configWithInstructions: OpencodeConfig = {
    ...config,
    instructions: [...rulePaths, ...config.instructions],
  }
  await writeFile(join(tempDir, 'opencode.json'), JSON.stringify(configWithInstructions, null, 2))

  return { tempDir, rulePaths }
}
