import type { McpToolDefinition } from './types'

export const GITHUB_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'github',
  mcpConfig: {
    type: 'remote',
    url: 'https://api.githubcopilot.com/mcp',
    enabled: true,
    oauth: false,
    headers: {
      Authorization: 'Bearer {env:GITHUB_TOKEN}',
    },
  },
  permission: { 'github_*': 'allow' },
  prompt: `## github (repository access)
- Full GitHub repository access for PRs, issues, code, and releases
- Search code, read/create issues and PRs, manage branches
- Access commit history, file contents, and repository metadata
- Git operations are read-only on remote — keep changes local unless explicitly asked to push`,
}

export const PW_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'pw',
  mcpConfig: {
    type: 'local',
    command: ['npx', '@playwright/mcp@latest', '--headless', '--no-sandbox'],
    enabled: true,
  },
  permission: {
    'browser_*': 'allow',
    browser_take_screenshot: 'deny',
    browser_snapshot: 'deny',
  },
  prompt: `## pw (browser automation)
- Playwright-based headless browser automation for web scraping and interaction
- Cookies/state persist across sessions
- Always call \`browser_close\` when done to free resources
- If a page snapshot is unreadable or too large, try resizing to phone size — mobile UIs tend to be lighter`,
  instructions: `## browser_* (browser automation)
- Use browser_navigate, browser_click, etc. to retrieve content and interact with websites

### Use browser tools (default) when:
- Scraping public content
- Automated data collection
- Tasks that don't require user interaction
- Background automation
- API-like interactions with websites

### Important notes:
- Cookies/state persisted across sessions

### Cookie sharing and instance switching
- Chromium flags include "--isolated"
- All cookies (session and persistent) will be available after switching
- This is true across parallel tasks, only one of them can use browser at a time. Delegate serially if two or more tasks need browser.`,
}

export const JIRA_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'jira',
  mcpConfig: {
    type: 'remote',
    url: 'https://mcp.atlassian.com/v1/mcp',
    enabled: true,
  },
  permission: { 'jira_*': 'allow' },
  prompt: `## jira (issue tracking)
- Access Jira for issue tracking, project management, and sprint planning
- Search issues, read details, and manage workflows
- Verify before mutating — read the issue first, then update`,
}

export const NOTION_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'notion',
  mcpConfig: {
    type: 'remote',
    url: 'https://mcp.notion.com/mcp',
    enabled: true,
  },
  permission: { 'notion_*': 'allow' },
  prompt: `## notion (documentation)
- Access Notion for internal documentation, specs, and knowledge base
- Search pages, fetch content, query databases
- Read page before updating to avoid overwriting content`,
}

export const SENTRY_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'sentry',
  mcpConfig: {
    type: 'remote',
    url: 'https://mcp.sentry.dev/mcp',
    enabled: true,
  },
  permission: { 'sentry_*': 'allow' },
  prompt: `## sentry (error tracking)
- Full Sentry access for debugging, Autofix, issue management, and project creation
- Search issues and events, get details, traces, and profiles
- Manage issues (update status, assign), create projects and teams
- Trigger AI analysis with Seer/Autofix`,
}

export const SLACK_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'slack',
  mcpConfig: {
    type: 'local',
    command: ['slack-mcp-server', '--transport', 'stdio'],
    enabled: true,
    environment: {
      SLACK_MCP_XOXC_TOKEN: '{env:SLACK_MCP_XOXC_TOKEN}',
      SLACK_MCP_XOXD_TOKEN: '{env:SLACK_MCP_XOXD_TOKEN}',
      SLACK_MCP_ADD_MESSAGE_TOOL: '{env:SLACK_MCP_ALLOWED_CHANNELS}',
    },
  },
  permission: { 'slack_*': 'allow' },
  prompt: `## slack (messaging)
- Access Slack for reading conversations, searching messages, and listing channels
- Send messages only to allowed channels (configured via env)`,
}

export const FIGMA_TOOL: McpToolDefinition = {
  kind: 'mcp',
  mcpName: 'figma',
  mcpConfig: {
    type: 'local',
    command: ['node', '/usr/lib/node_modules/figma-developer-mcp/dist/bin.js', '--stdio'],
    enabled: true,
    environment: {
      FIGMA_API_KEY: '{env:FIGMA_TOKEN}',
    },
  },
  permission: { 'figma_*': 'allow' },
  prompt: `## figma (design access)
- Access Figma for design context, tokens, component mappings, and screenshots
- Get comprehensive file data including layout, content, visuals, and component info
- Download SVG and PNG images from Figma files`,
}
