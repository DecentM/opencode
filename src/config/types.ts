// Permission can be a simple string or a nested object mapping glob patterns to allow/deny
type PermissionValue = 'allow' | 'deny'
type PermissionEntry = PermissionValue | Record<string, PermissionValue>
export type PermissionMap = Record<string, PermissionEntry>

export type AgentMode = 'primary' | 'subagent'

export type AgentFrontmatter = {
  description: string
  model: string
  mode: AgentMode
  temperature: number
  hidden?: boolean
  permission: PermissionMap
}

export type AgentConfig = AgentFrontmatter & {
  prompt: string
}

export type DisabledAgentConfig = {
  disable: true
}

// Partial override for built-in agents (e.g. title) that only need a model change
export type AgentOverrideConfig = {
  model: string
}

export type LocalMcpConfig = {
  type: 'local'
  command: string[]
  enabled: true
  environment?: Record<string, string>
}

export type RemoteMcpConfig = {
  type: 'remote'
  url: string
  enabled: true
  oauth?: boolean
  headers?: Record<string, string>
}

export type McpConfig = LocalMcpConfig | RemoteMcpConfig

export type OpencodeConfig = {
  $schema: string
  plugin: unknown[]
  autoupdate: boolean
  snapshot: boolean
  logLevel: string
  default_agent: string
  watcher: {
    ignore: string[]
  }
  share: string
  permission: Record<string, string>
  instructions: string[]
  agent: Record<string, AgentConfig | DisabledAgentConfig | AgentOverrideConfig>
  mcp: Record<string, McpConfig>
}
