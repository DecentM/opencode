import { composeConfig, writeTempConfig } from '../src/config/compose'
import { loadRules } from '../src/config/rules'
import { getRuleNames } from '../src/config/rules/index'
import type { RuleContext } from '../src/config/rules/index'
import { ALL_TOOLS } from '../src/config/tools/index'
import { defaultSettings } from '../src/settings/defaults'
import type { Credentials, Settings } from '../src/settings/types'

const REQUIRED_BINARIES = ['opencode', 'jq'] as const

export type DependencyCheckResult = {
  allRequiredFound: boolean
}

const checkDependencies = (): DependencyCheckResult => {
  let allRequiredFound = true

  for (const bin of REQUIRED_BINARIES) {
    const path = Bun.which(bin)

    if (!path) {
      console.error(
        `${bin} not installed or not available via $PATH. Please install it and try again.`
      )
      allRequiredFound = false
    }
  }

  return { allRequiredFound }
}

// Read a required env var, pushing to `missing` if absent.
const requireEnv = (key: string, missing: string[]): string => {
  const value = process.env[key]

  if (value == null || value === '') {
    missing.push(key)
    return ''
  }

  return value
}

const readSettings = (): Settings | null => {
  const missing: string[] = []

  const credentials: Credentials = {
    MY_NAME: requireEnv('MY_NAME', missing),
    GITHUB_TOKEN: requireEnv('GITHUB_TOKEN', missing),
    FIGMA_TOKEN: requireEnv('FIGMA_TOKEN', missing),
    SLACK_MCP_XOXC_TOKEN: requireEnv('SLACK_MCP_XOXC_TOKEN', missing),
    SLACK_MCP_XOXD_TOKEN: requireEnv('SLACK_MCP_XOXD_TOKEN', missing),
    SLACK_MCP_ALLOWED_CHANNELS: requireEnv('SLACK_MCP_ALLOWED_CHANNELS', missing),
  }

  if (missing.length > 0) {
    console.error('Missing required environment variables:')
    for (const name of missing) {
      console.error(`  - ${name}`)
    }
    return null
  }

  // All agents, tools, rules, and skills are enabled by default
  const settings = defaultSettings(getRuleNames())
  settings.credentials = credentials

  return settings
}

const main = async (): Promise<number> => {
  // Dependency checks
  const { allRequiredFound } = checkDependencies()
  if (!allRequiredFound) return 1

  // Read settings (credentials from env, all features enabled)
  const settings = readSettings()
  if (!settings) return 1

  // Compose config — all rules, skills, and tools are enabled
  const enabledRuleNames = new Set(getRuleNames())
  const enabledToolNames = Object.keys(ALL_TOOLS)
  const ruleCtx: RuleContext = { enabledToolNames, allTools: ALL_TOOLS }
  const rules = loadRules(enabledRuleNames, ruleCtx)
  const { config, agentPrompts } = composeConfig(settings, rules)
  const { tempDir } = await writeTempConfig(config, agentPrompts, rules)

  // Find opencode binary
  const opencodeBin = Bun.which('opencode')

  if (!opencodeBin) {
    console.error('opencode binary not found.')
    return 1
  }

  // Spawn opencode — inject credentials as env vars for {env:VAR} interpolation
  const child = Bun.spawnSync([opencodeBin, ...process.argv.slice(2)], {
    env: {
      ...process.env,
      ...settings.credentials,
      SHELL: Bun.which('bash') ?? process.env.SHELL ?? '/bin/sh',
      OPENCODE_CONFIG_DIR: tempDir,
      OPENCODE_EXPERIMENTAL_LSP_TOOL: 'true',
    },
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })

  return child.exitCode ?? 1
}

if (import.meta.main) {
  const code = await main()
  process.exit(code)
}
