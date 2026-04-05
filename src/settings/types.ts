// Credentials injected into the opencode spawn environment
export type Credentials = {
  MY_NAME: string
  GITHUB_TOKEN: string
  FIGMA_TOKEN: string
  SLACK_MCP_XOXC_TOKEN: string
  SLACK_MCP_XOXD_TOKEN: string
  SLACK_MCP_ALLOWED_CHANNELS: string
}

// Toggle state — true = enabled
export type ToggleSettings = {
  agents: Record<string, boolean>
  mcpTools: Record<string, boolean>
  pluginTools: Record<string, boolean>
  rules: Record<string, boolean>
}

export type Settings = {
  credentials: Credentials
  toggles: ToggleSettings
}
