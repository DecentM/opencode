import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { defaultSettings } from './defaults'
import type { Settings } from './types'

export const getSettingsDir = (): string => {
  const platform = process.platform

  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'opencode-launcher')
  }

  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'opencode-launcher')
  }

  // Linux / other POSIX
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  return join(xdgConfig, 'opencode-launcher')
}

export const getSettingsPath = (): string => join(getSettingsDir(), 'settings.json')

// Deep merge: fill in missing keys from defaults without overwriting existing values
const mergeWithDefaults = (saved: Partial<Settings>, defaults: Settings): Settings => ({
  credentials: { ...defaults.credentials, ...(saved.credentials ?? {}) },
  toggles: {
    agents: { ...defaults.toggles.agents, ...(saved.toggles?.agents ?? {}) },
    mcpTools: { ...defaults.toggles.mcpTools, ...(saved.toggles?.mcpTools ?? {}) },
    pluginTools: { ...defaults.toggles.pluginTools, ...(saved.toggles?.pluginTools ?? {}) },
    rules: { ...defaults.toggles.rules, ...(saved.toggles?.rules ?? {}) },
    skills: { ...defaults.toggles.skills, ...(saved.toggles?.skills ?? {}) },
  },
})

export const loadSettings = async (ruleNames: string[]): Promise<Settings> => {
  const path = getSettingsPath()
  const defaults = defaultSettings(ruleNames)

  if (!existsSync(path)) {
    return defaults
  }

  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return mergeWithDefaults(parsed, defaults)
  } catch {
    return defaults
  }
}

export const saveSettings = async (settings: Settings): Promise<void> => {
  const dir = getSettingsDir()
  await mkdir(dir, { recursive: true })
  await writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
