/**
 * OpenCode Skeleton Plugin
 * ========================
 *
 * A comprehensive reference implementation demonstrating ALL available OpenCode plugin hooks.
 * This file serves as documentation and a starting point for plugin developers.
 *
 * @module skeleton-plugin
 * @version 1.0.0
 * @see https://opencode.ai/docs/plugins
 */

import type { AuthOuathResult, Hooks, Plugin, PluginInput } from '@opencode-ai/plugin'

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

/**
 * The main plugin export.
 *
 * OpenCode plugins are async functions that receive context about the current
 * project and return a Hooks object containing handlers for various lifecycle events.
 *
 * @param input - Plugin initialization context
 * @param input.client - OpenCode SDK client for API interactions
 * @param input.project - Current project information (id, worktree, vcs info)
 * @param input.directory - The working directory path
 * @param input.worktree - The git worktree path (or project root if no git)
 * @param input.serverUrl - URL of the OpenCode server
 * @param input.$ - Bun shell instance for executing commands
 *
 * @returns Promise<Hooks> - Object containing all hook implementations
 */
const SkeletonPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const { client, project, directory, worktree, serverUrl, $ } = input

  // Plugin initialization logic goes here
  // You can set up state, load configuration, initialize connections, etc.
  // console.log('[skeleton-plugin] Initializing...')
  // console.log('[skeleton-plugin] Project:', project.id)
  // console.log('[skeleton-plugin] Directory:', directory)
  // console.log('[skeleton-plugin] Worktree:', worktree)
  // console.log('[skeleton-plugin] Server URL:', serverUrl.toString())

  return {
    // =========================================================================
    // LIFECYCLE HOOKS
    // =========================================================================

    /**
     * config Hook
     * -----------
     * Called when OpenCode configuration is loaded or updated.
     *
     * @lifecycle Called during initialization and when config changes
     * @input config - The complete OpenCode configuration object
     * @mutates Nothing - this is for reading/reacting to config
     *
     * @useCases
     * - React to configuration changes
     * - Validate plugin-specific configuration
     * - Initialize plugin state based on config
     * - Log configuration for debugging
     *
     * @example
     * ```typescript
     * async config(input) {
     *   // Check if a specific provider is configured
     *   if (input.provider?.['my-provider']) {
     *     await initializeMyProvider(input.provider['my-provider'])
     *   }
     *
     *   // React to theme changes
     *   if (input.theme) {
     *     updatePluginTheme(input.theme)
     *   }
     * }
     * ```
     */
    async config(input) {
      // console.log('[skeleton-plugin] config:', JSON.stringify(input, null, 2))
      // Example: Check for custom plugin configuration
      // const pluginConfig = input.experimental?.myPlugin
      // if (pluginConfig) {
      //   applyPluginConfig(pluginConfig)
      // }
    },

    /**
     * event Hook
     * ----------
     * Called for every event emitted by the OpenCode system.
     * This is a global event listener that receives all system events.
     *
     * @lifecycle Called whenever any event occurs in the system
     * @input event - The event object with type and properties
     *
     * Event categories:
     * - Installation: installation.updated, installation.update-available
     * - Server/Lifecycle: server.instance.disposed, server.connected, global.disposed
     * - Project/Worktree: project.updated, worktree.ready, worktree.failed
     * - VCS: vcs.branch.updated
     * - LSP: lsp.updated, lsp.client.diagnostics
     * - Files: file.edited, file.watcher.updated
     * - Sessions: session.created, session.updated, session.deleted, session.status,
     *             session.idle, session.compacted, session.diff, session.error
     * - Messages: message.updated, message.removed, message.part.updated, message.part.removed
     * - Todo: todo.updated
     * - Commands: command.executed
     * - Permissions: permission.updated, permission.replied
     * - Questions: question.asked, question.replied, question.rejected (v2 SDK)
     * - MCP: mcp.tools.changed, mcp.browser.open.failed (v2 SDK)
     * - TUI: tui.prompt.append, tui.command.execute, tui.toast.show, tui.session.select (v2 SDK)
     * - PTY: pty.created, pty.updated, pty.exited, pty.deleted
     *
     * @useCases
     * - Track session activity for analytics
     * - React to file changes (auto-format, lint, etc.)
     * - Monitor permission requests
     * - Sync state with external systems
     * - Implement custom logging/telemetry
     *
     * @example
     * ```typescript
     * async event({ event }) {
     *   switch (event.type) {
     *     case 'session.created':
     *       await notifyTeam(`New session: ${event.properties.info.title}`)
     *       break
     *     case 'file.edited':
     *       await triggerCI(event.properties.file)
     *       break
     *     case 'permission.updated':
     *       await logSecurityEvent(event.properties)
     *       break
     *     case 'vcs.branch.updated':
     *       await refreshBranchInfo(event.properties)
     *       break
     *   }
     * }
     * ```
     */
    async event({ event }) {
      switch (event.type) {
        // =====================================================================
        // INSTALLATION EVENTS
        // =====================================================================

        case 'installation.updated':
          // Fires when: OpenCode installation info changes (version, paths, etc.)
          // Properties: info (installation details)
          // Use cases: Track version changes, log installation updates
          // console.log('[skeleton-plugin] installation.updated:', event.properties.info)
          break

        case 'installation.update-available':
          // Fires when: A new version of OpenCode is available
          // Properties: version (new version string), current (current version)
          // Use cases: Notify users of updates, auto-update workflows
          // console.log('[skeleton-plugin] installation.update-available:', event.properties)
          break

        // =====================================================================
        // SERVER/LIFECYCLE EVENTS
        // =====================================================================

        case 'server.instance.disposed':
          // Fires when: A server instance (project-specific) is disposed/cleaned up
          // Properties: instanceID, reason
          // Use cases: Cleanup resources, log server lifecycle
          // console.log('[skeleton-plugin] server.instance.disposed:', event.properties)
          break

        case 'server.connected':
          // Fires when: A client connects to the server via SSE
          // Properties: connectionID, clientInfo
          // Note: SSE-only event - plugins won't typically see this
          // console.log('[skeleton-plugin] server.connected:', event.properties)
          break

        // Note: 'global.disposed' exists but is global-only and not exposed to plugins
        // Fires when: The global server instance is shutting down
        // Properties: reason

        // =====================================================================
        // PROJECT/WORKTREE EVENTS (Global-only - not exposed to plugins)
        // =====================================================================

        // Note: 'project.updated' exists but is global-only and not exposed to plugins
        // Fires when: Project configuration or state changes
        // Properties: info (project details), changes

        // Note: 'worktree.ready' exists but is global-only and not exposed to plugins
        // Fires when: A git worktree becomes ready for use
        // Properties: worktree (path), projectID

        // Note: 'worktree.failed' exists but is global-only and not exposed to plugins
        // Fires when: A git worktree fails to initialize
        // Properties: worktree (path), error, projectID

        // =====================================================================
        // VCS EVENTS
        // =====================================================================

        case 'vcs.branch.updated':
          // Fires when: Git branch changes (checkout, new branch, etc.)
          // Properties: branch (current branch name), previous (previous branch)
          // Use cases: React to branch switches, update context
          // console.log('[skeleton-plugin] vcs.branch.updated:', event.properties.branch)
          break

        // =====================================================================
        // LSP EVENTS
        // =====================================================================

        case 'lsp.updated':
          // Fires when: Language server state changes (started, stopped, etc.)
          // Properties: language, status, serverInfo
          // Use cases: Track LSP health, log language server events
          // console.log('[skeleton-plugin] lsp.updated:', event.properties)
          break

        case 'lsp.client.diagnostics':
          // Fires when: LSP diagnostics (errors, warnings) are received
          // Properties: uri (file path), diagnostics (array of issues)
          // Use cases: Custom error handling, aggregate diagnostics
          // console.log('[skeleton-plugin] lsp.client.diagnostics:', event.properties.uri, event.properties.diagnostics?.length)
          break

        // =====================================================================
        // FILE EVENTS
        // =====================================================================

        case 'file.edited':
          // Fires when: A file is edited (by user or AI)
          // Properties: file (path), sessionID, edits
          // Use cases: Trigger linting, auto-format, sync to external systems
          // console.log('[skeleton-plugin] file.edited:', event.properties.file)
          break

        case 'file.watcher.updated':
          // Fires when: File watcher detects filesystem changes
          // Properties: files (array of changed paths), type (add/change/delete)
          // Use cases: React to external file changes, refresh caches
          // console.log('[skeleton-plugin] file.watcher.updated:', event.properties)
          break

        // =====================================================================
        // SESSION EVENTS
        // =====================================================================

        case 'session.created':
          // Fires when: A new chat session is created
          // Properties: info (session details including id, title, time)
          // Use cases: Log session creation, notify team, initialize tracking
          // console.log('[skeleton-plugin] session.created:', event.properties.info?.id, event.properties.info?.title)
          break

        case 'session.updated':
          // Fires when: Session metadata changes (title, agent, model, etc.)
          // Properties: info (updated session details)
          // Use cases: Track session changes, sync state
          // console.log('[skeleton-plugin] session.updated:', event.properties.info?.id)
          break

        case 'session.deleted':
          // Fires when: A session is deleted
          // Properties: sessionID
          // Use cases: Cleanup resources, log deletion, update UI
          // console.log('[skeleton-plugin] session.deleted:', event.properties.sessionID)
          break

        case 'session.status':
          // Fires when: Session status changes (idle, running, etc.)
          // Properties: sessionID, status
          // Use cases: Track activity, update status indicators
          // console.log('[skeleton-plugin] session.status:', event.properties.sessionID, event.properties.status)
          break

        case 'session.idle':
          // Fires when: Session becomes idle (deprecated but still emitted)
          // Properties: sessionID
          // Use cases: Trigger auto-save, cleanup, notifications
          // Note: Deprecated - use session.status instead
          // console.log('[skeleton-plugin] session.idle (deprecated):', event.properties.sessionID)
          break

        case 'session.compacted':
          // Fires when: Session history is compacted to reduce tokens
          // Properties: sessionID, summary, originalTokens, compactedTokens
          // Use cases: Log compaction events, track token usage
          // console.log('[skeleton-plugin] session.compacted:', event.properties.sessionID)
          break

        case 'session.diff':
          // Fires when: Session diff is generated (for undo/redo)
          // Properties: sessionID, diff
          // Use cases: Track changes, implement custom undo/redo
          // console.log('[skeleton-plugin] session.diff:', event.properties.sessionID)
          break

        case 'session.error':
          // Fires when: An error occurs in a session
          // Properties: sessionID, error, message
          // Use cases: Error tracking, notifications, recovery
          // console.log('[skeleton-plugin] session.error:', event.properties.sessionID, event.properties.error)
          break

        // =====================================================================
        // MESSAGE EVENTS
        // =====================================================================

        case 'message.updated':
          // Fires when: A message is created or updated
          // Properties: info (message details including id, role, content)
          // Use cases: Track conversation, log messages, analytics
          // console.log('[skeleton-plugin] message.updated:', event.properties.info?.id, event.properties.info?.role)
          break

        case 'message.removed':
          // Fires when: A message is removed from the session
          // Properties: messageID, sessionID
          // Use cases: Sync state, cleanup, log removals
          // console.log('[skeleton-plugin] message.removed:', event.properties.messageID)
          break

        case 'message.part.updated':
          // Fires when: A message part (text, tool call, etc.) is updated
          // Properties: info (part details including id, type, content)
          // Use cases: Track streaming content, react to tool calls
          // console.log('[skeleton-plugin] message.part.updated:', event.properties.info?.id, event.properties.info?.type)
          break

        case 'message.part.removed':
          // Fires when: A message part is removed
          // Properties: partID, messageID, sessionID
          // Use cases: Sync state, cleanup
          // console.log('[skeleton-plugin] message.part.removed:', event.properties.partID)
          break

        // =====================================================================
        // TODO EVENTS
        // =====================================================================

        case 'todo.updated':
          // Fires when: A todo item is created, updated, or completed
          // Properties: info (todo details including id, title, status)
          // Use cases: Sync todos, track progress, notifications
          // console.log('[skeleton-plugin] todo.updated:', event.properties.info?.id, event.properties.info?.status)
          break

        // =====================================================================
        // COMMAND EVENTS
        // =====================================================================

        case 'command.executed':
          // Fires when: A slash command is executed
          // Properties: command (name), arguments, sessionID
          // Use cases: Log command usage, analytics, audit trail
          // console.log('[skeleton-plugin] command.executed:', event.properties.command, event.properties.arguments)
          break

        // =====================================================================
        // PERMISSION EVENTS
        // =====================================================================

        case 'permission.updated':
          // Fires when: A permission is requested from the user
          // Properties: type, pattern, title, metadata
          // Use cases: Log permission requests, security monitoring
          // Note: In v2 SDK this event may be named 'permission.asked'
          // console.log('[skeleton-plugin] permission.updated:', event.properties.type, event.properties.pattern)
          break

        case 'permission.replied':
          // Fires when: User responds to a permission request
          // Properties: type, pattern, allowed (boolean), permanent
          // Use cases: Track permission decisions, security audit
          // console.log('[skeleton-plugin] permission.replied:', event.properties.type, event.properties.allowed)
          break

        // =====================================================================
        // QUESTION EVENTS (v2 SDK - may not be available in all versions)
        // =====================================================================

        // Note: 'question.asked' is a v2 SDK event
        // Fires when: A question is asked to the user (confirmation, input, etc.)
        // Properties: id, type, message, options
        // Use cases: Track user interactions, custom handling

        // Note: 'question.replied' is a v2 SDK event
        // Fires when: User answers a question
        // Properties: id, answer
        // Use cases: Log responses, analytics

        // Note: 'question.rejected' is a v2 SDK event
        // Fires when: User rejects/cancels a question
        // Properties: id
        // Use cases: Track rejections, analytics

        // =====================================================================
        // MCP EVENTS (v2 SDK - may not be available in all versions)
        // =====================================================================

        // Note: 'mcp.tools.changed' is a v2 SDK event
        // Fires when: MCP tools are added, removed, or updated
        // Properties: tools (array of tool definitions)
        // Use cases: React to tool availability, update UI

        // Note: 'mcp.browser.open.failed' is a v2 SDK event
        // Fires when: MCP fails to open a browser (for OAuth, etc.)
        // Properties: url, error
        // Use cases: Handle browser failures, fallback flows

        // =====================================================================
        // TUI EVENTS
        // =====================================================================

        case 'tui.prompt.append':
          // Fires when: Text is appended to the TUI prompt
          // Properties: text
          // Use cases: Custom prompt handling, macros
          // console.log('[skeleton-plugin] tui.prompt.append:', event.properties.text)
          break

        case 'tui.command.execute':
          // Fires when: TUI command execution is requested
          // Properties: command, arguments
          // Use cases: Intercept TUI commands, logging
          // console.log('[skeleton-plugin] tui.command.execute:', event.properties.command)
          break

        case 'tui.toast.show':
          // Fires when: A toast notification should be shown
          // Properties: message, type (info/success/warning/error)
          // Use cases: Custom notification handling
          // console.log('[skeleton-plugin] tui.toast.show:', event.properties.type, event.properties.message)
          break

        // Note: 'tui.session.select' is a v2 SDK event
        // Fires when: Session selection changes in TUI
        // Properties: sessionID
        // Use cases: React to session changes, update context

        // =====================================================================
        // PTY EVENTS
        // =====================================================================

        case 'pty.created':
          // Fires when: A pseudo-terminal is created
          // Properties: id, command, cwd
          // Use cases: Track terminal sessions, logging
          // console.log('[skeleton-plugin] pty.created:', event.properties.id, event.properties.command)
          break

        case 'pty.updated':
          // Fires when: PTY output or state changes
          // Properties: id, output, state
          // Use cases: Monitor command output, react to state changes
          // console.log('[skeleton-plugin] pty.updated:', event.properties.id)
          break

        case 'pty.exited':
          // Fires when: PTY process exits
          // Properties: id, exitCode, signal
          // Use cases: Handle command completion, error detection
          // console.log('[skeleton-plugin] pty.exited:', event.properties.id, event.properties.exitCode)
          break

        case 'pty.deleted':
          // Fires when: PTY is cleaned up and removed
          // Properties: id
          // Use cases: Cleanup resources, logging
          // console.log('[skeleton-plugin] pty.deleted:', event.properties.id)
          break

        // =====================================================================
        // DEFAULT/UNKNOWN
        // =====================================================================

        default:
          // Handle unknown event types (future events, custom events)
          // console.log('[skeleton-plugin] unknown event:', event.type, event.properties)
          break
      }
    },

    // =========================================================================
    // AUTHENTICATION HOOKS
    // =========================================================================

    /**
     * auth Hook
     * ---------
     * Define custom authentication methods for providers.
     * Supports OAuth flows and API key authentication.
     *
     * @lifecycle Called when user initiates authentication for the provider
     * @structure AuthHook object with provider name and auth methods
     *
     * Methods can be:
     * - oauth: Browser-based OAuth flow with callback
     * - api: Direct API key entry with optional prompts
     *
     * Each method can define prompts for user input:
     * - text: Free-form text input
     * - select: Dropdown selection
     *
     * @useCases
     * - Custom provider authentication
     * - Enterprise SSO integration
     * - Multi-factor authentication flows
     * - API key management with validation
     *
     * @example
     * ```typescript
     * auth: {
     *   provider: 'my-custom-provider',
     *   loader: async (auth, provider) => {
     *     const credentials = await auth()
     *     return { apiKey: credentials.key, region: 'us-east-1' }
     *   },
     *   methods: [
     *     {
     *       type: 'oauth',
     *       label: 'Login with MyProvider',
     *       authorize: async () => ({
     *         url: 'https://myprovider.com/oauth/authorize?...',
     *         instructions: 'Complete login in your browser',
     *         method: 'auto',
     *         callback: async () => {
     *           const tokens = await pollForTokens()
     *           return { type: 'success', access: tokens.access, refresh: tokens.refresh, expires: tokens.expires }
     *         },
     *       }),
     *     },
     *   ],
     * }
     * ```
     */
    auth: {
      /**
       * The provider ID this auth hook handles.
       * Must match a provider defined in your configuration.
       */
      provider: 'skeleton-provider',

      /**
       * Optional loader function to transform stored auth into provider options.
       * Called after successful authentication to prepare credentials for use.
       *
       * @param auth - Function to retrieve stored authentication data
       * @param provider - Provider configuration object
       * @returns Record of options to pass to the provider
       */
      loader: async (auth, provider) => {
        // console.log('[skeleton-plugin] auth.loader called for:', provider.id)

        // Retrieve stored credentials
        // const credentials = await auth()
        // if (credentials.type === 'api') {
        //   return { apiKey: credentials.key }
        // } else if (credentials.type === 'oauth') {
        //   return { accessToken: credentials.access }
        // }

        return {}
      },

      /**
       * Authentication methods available for this provider.
       */
      methods: [
        /**
         * OAuth Authentication Method
         *
         * Initiates a browser-based OAuth flow. The user is directed to a URL
         * to complete authentication, and the callback handles the response.
         */
        {
          type: 'oauth',
          label: 'Login with Skeleton Provider',

          /**
           * Optional prompts to collect before starting OAuth flow.
           * Useful for selecting regions, organizations, etc.
           */
          prompts: [
            {
              type: 'select',
              key: 'region',
              message: 'Select your region:',
              options: [
                { label: 'US East', value: 'us-east-1', hint: 'Default region' },
                { label: 'US West', value: 'us-west-2' },
                { label: 'Europe', value: 'eu-west-1' },
              ],
              // Only show this prompt in certain conditions
              // condition: (inputs) => inputs.enterprise === 'true',
            },
          ],

          /**
           * Initiate the OAuth flow.
           *
           * @param inputs - Values from prompts (if any)
           * @returns OAuth configuration with URL, instructions, and callback
           */
          async authorize(inputs): Promise<AuthOuathResult> {
            // console.log('[skeleton-plugin] auth.oauth.authorize:', inputs)

            const region = inputs?.region ?? 'us-east-1'

            return {
              // URL to open in the user's browser
              url: `https://example.com/oauth/authorize?region=${region}&client_id=xxx`,

              // Instructions shown to the user
              instructions:
                'Please complete the login in your browser. The window will close automatically when complete.',

              // 'auto' = callback polls for completion
              // 'code' = user enters a code from the browser
              method: 'auto',

              // Callback to complete the OAuth flow
              callback: async () => {
                // Example: Poll for OAuth completion
                // const tokens = await pollForOAuthCompletion()
                // if (tokens) {
                //   return {
                //     type: 'success',
                //     access: tokens.accessToken,
                //     refresh: tokens.refreshToken,
                //     expires: tokens.expiresAt,
                //     provider: 'skeleton-provider', // Optional: override provider
                //   }
                // }

                // Return success with tokens
                return {
                  type: 'success',
                  access: 'example-access-token',
                  refresh: 'example-refresh-token',
                  expires: Date.now() + 3600000, // 1 hour
                }

                // Or return failure
                // return { type: 'failed' }
              },
            }
          },
        },

        /**
         * API Key Authentication Method
         *
         * Direct API key entry with optional validation.
         */
        {
          type: 'api',
          label: 'Enter API Key',

          /**
           * Prompts for collecting API key and related info.
           */
          prompts: [
            {
              type: 'text',
              key: 'apiKey',
              message: 'Enter your API key:',
              placeholder: 'sk-...',
              /**
               * Optional validation function.
               * Return undefined if valid, or an error message string if invalid.
               */
              validate: (value) => {
                if (!value || value.length < 10) {
                  return 'API key must be at least 10 characters'
                }
                if (!value.startsWith('sk-')) {
                  return 'API key must start with "sk-"'
                }
                return undefined
              },
            },
            {
              type: 'text',
              key: 'orgId',
              message: 'Organization ID (optional):',
              placeholder: 'org-...',
              // Only show this prompt if API key is provided
              condition: (inputs) => !!inputs.apiKey,
            },
          ],

          /**
           * Optional authorization function.
           * Called after prompts are completed to validate and store the key.
           */
          async authorize(inputs) {
            // console.log('[skeleton-plugin] auth.api.authorize:', inputs)

            // Example: Validate the API key with the service
            // const isValid = await validateApiKey(inputs?.apiKey)
            // if (!isValid) {
            //   return { type: 'failed' }
            // }

            return {
              type: 'success',
              key: inputs?.apiKey ?? '',
              // Optionally override the provider
              // provider: 'skeleton-provider',
            }
          },
        },
      ],
    },

    // =========================================================================
    // CHAT HOOKS
    // =========================================================================

    /**
     * chat.message Hook
     * -----------------
     * Called when a new message is received in a chat session.
     * Allows modification of message content and parts before processing.
     *
     * @lifecycle Called after user submits a message, before LLM processing
     * @input sessionID, agent, model info, messageID, variant
     * @output Mutable: message (UserMessage), parts (Part[])
     *
     * @useCases
     * - Inject context into messages (time, location, user info)
     * - Add automatic file attachments
     * - Filter or modify message content
     * - Add agent-specific instructions
     * - Implement message preprocessing
     *
     * @example
     * ```typescript
     * async 'chat.message'(input, output) {
     *   // Add current time context
     *   output.parts.push({
     *     id: crypto.randomUUID(),
     *     sessionID: input.sessionID,
     *     messageID: input.messageID ?? '',
     *     type: 'text',
     *     text: `[Current time: ${new Date().toISOString()}]`,
     *     synthetic: true,
     *   })
     *
     *   // Add a file attachment based on agent
     *   if (input.agent === 'code-review') {
     *     output.parts.push({
     *       id: crypto.randomUUID(),
     *       sessionID: input.sessionID,
     *       messageID: input.messageID ?? '',
     *       type: 'file',
     *       mime: 'text/plain',
     *       filename: 'guidelines.md',
     *       url: 'file:///path/to/guidelines.md',
     *     })
     *   }
     * }
     * ```
     */
    async 'chat.message'(input, output) {
      // console.log('[skeleton-plugin] chat.message:', input)
      // console.log('[skeleton-plugin] chat.message output:', output)
      // Example: Add context to every message
      // output.parts.push({
      //   id: crypto.randomUUID(),
      //   sessionID: input.sessionID,
      //   messageID: input.messageID ?? '',
      //   type: 'text',
      //   text: `[Plugin context: User timezone is UTC]`,
      //   synthetic: true,
      // })
    },

    /**
     * chat.params Hook
     * ----------------
     * Modify LLM parameters before a request is made.
     * Allows fine-tuning of model behavior per-request.
     *
     * @lifecycle Called just before sending request to LLM provider
     * @input sessionID, agent, model, provider context, message
     * @output Mutable: temperature, topP, topK, options
     *
     * @useCases
     * - Dynamic temperature adjustment based on task
     * - Agent-specific parameter tuning
     * - Provider-specific option injection
     * - A/B testing different parameters
     *
     * @example
     * ```typescript
     * async 'chat.params'(input, output) {
     *   // Lower temperature for code generation
     *   if (input.agent === 'build') {
     *     output.temperature = 0.1
     *     output.topP = 0.9
     *   }
     *
     *   // Higher temperature for creative tasks
     *   if (input.agent === 'brainstorm') {
     *     output.temperature = 0.9
     *     output.topK = 50
     *   }
     *
     *   // Add provider-specific options
     *   if (input.provider.info.id === 'anthropic') {
     *     output.options.stopSequences = ['```']
     *   }
     * }
     * ```
     */
    async 'chat.params'(input, output) {
      // console.log('[skeleton-plugin] chat.params input:', input)
      // console.log('[skeleton-plugin] chat.params output:', output)
      // Example: Adjust parameters based on agent
      // if (input.agent === 'code') {
      //   output.temperature = 0.2
      // }
    },

    /**
     * chat.headers Hook
     * -----------------
     * Inject custom HTTP headers into LLM API requests.
     * Useful for authentication, tracing, and custom headers.
     *
     * @lifecycle Called just before HTTP request to LLM provider
     * @input sessionID, agent, model, provider context, message
     * @output Mutable: headers (Record<string, string>)
     *
     * @useCases
     * - Add authentication tokens
     * - Inject tracing/correlation IDs
     * - Add custom provider headers
     * - Implement request signing
     *
     * @example
     * ```typescript
     * async 'chat.headers'(input, output) {
     *   // Add correlation ID for tracing
     *   output.headers['X-Correlation-ID'] = crypto.randomUUID()
     *
     *   // Add custom authentication
     *   output.headers['X-Custom-Auth'] = await getCustomToken()
     *
     *   // Provider-specific headers
     *   if (input.provider.info.id === 'azure') {
     *     output.headers['api-version'] = '2024-02-15-preview'
     *   }
     * }
     * ```
     */
    async 'chat.headers'(input, output) {
      // console.log('[skeleton-plugin] chat.headers input:', input)
      // console.log('[skeleton-plugin] chat.headers output:', output)
      // Example: Add tracing headers
      // output.headers['X-Request-ID'] = crypto.randomUUID()
      // output.headers['X-Session-ID'] = input.sessionID
    },

    // =========================================================================
    // PERMISSION HOOKS
    // =========================================================================

    /**
     * permission.ask Hook
     * -------------------
     * Intercept permission requests before they're shown to the user.
     * Allows automatic approval/denial or modification of permission requests.
     *
     * @lifecycle Called when a tool requests permission
     * @input Permission object with type, pattern, title, metadata
     * @output Mutable: status ('ask' | 'deny' | 'allow')
     *
     * Permission types include:
     * - 'edit': File modification
     * - 'bash': Command execution (with pattern for command)
     * - 'webfetch': Network requests
     * - 'doom_loop': Protection against infinite loops
     * - 'external_directory': Access outside project
     *
     * @useCases
     * - Auto-approve safe operations
     * - Deny dangerous commands automatically
     * - Implement custom security policies
     * - Log all permission requests
     *
     * @example
     * ```typescript
     * async 'permission.ask'(input, output) {
     *   // Auto-approve read operations
     *   if (input.type === 'bash' && input.pattern?.includes('cat ')) {
     *     output.status = 'allow'
     *     return
     *   }
     *
     *   // Deny destructive commands
     *   if (input.type === 'bash') {
     *     const dangerous = ['rm -rf', 'DROP TABLE', 'DELETE FROM']
     *     if (dangerous.some(cmd => input.pattern?.includes(cmd))) {
     *       output.status = 'deny'
     *       return
     *     }
     *   }
     *
     *   // Log all permission requests
     *   await logPermission(input)
     * }
     * ```
     */
    async 'permission.ask'(input, output) {
      // console.log('[skeleton-plugin] permission.ask:', input)
      // console.log('[skeleton-plugin] permission.ask output:', output)
      // Example: Auto-approve certain patterns
      // if (input.type === 'edit' && input.pattern?.endsWith('.test.ts')) {
      //   output.status = 'allow'
      // }
      // Example: Auto-deny dangerous operations
      // if (input.type === 'bash' && input.pattern?.includes('rm -rf /')) {
      //   output.status = 'deny'
      // }
    },

    // =========================================================================
    // COMMAND HOOKS
    // =========================================================================

    /**
     * command.execute.before Hook
     * ---------------------------
     * Intercept slash commands before they're executed.
     * Allows modification of command output parts.
     *
     * @lifecycle Called when user executes a slash command, before processing
     * @input command name, sessionID, arguments string
     * @output Mutable: parts (Part[])
     *
     * @useCases
     * - Add context to command execution
     * - Log command usage
     * - Inject additional instructions
     * - Implement command aliases
     *
     * @example
     * ```typescript
     * async 'command.execute.before'(input, output) {
     *   // Log command execution
     *   await logCommand(input.command, input.arguments)
     *
     *   // Add context for specific commands
     *   if (input.command === 'review') {
     *     output.parts.push({
     *       id: crypto.randomUUID(),
     *       sessionID: input.sessionID,
     *       messageID: '',
     *       type: 'text',
     *       text: 'Remember to check for security vulnerabilities.',
     *     })
     *   }
     * }
     * ```
     */
    async 'command.execute.before'(input, output) {
      // console.log('[skeleton-plugin] command.execute.before:', input)
      // console.log('[skeleton-plugin] command.execute.before output:', output)
      // Example: Add context for specific commands
      // if (input.command === '/deploy') {
      //   output.parts.push({
      //     id: crypto.randomUUID(),
      //     sessionID: input.sessionID,
      //     messageID: '',
      //     type: 'text',
      //     text: `Deploying with arguments: ${input.arguments}`,
      //   })
      // }
    },

    // =========================================================================
    // TOOL EXECUTION HOOKS
    // =========================================================================

    /**
     * tool.execute.before Hook
     * ------------------------
     * Intercept tool calls before execution.
     * Allows modification of tool arguments.
     *
     * @lifecycle Called after LLM requests tool, before tool.execute()
     * @input tool name, sessionID, callID
     * @output Mutable: args (any - the tool arguments)
     *
     * @useCases
     * - Validate or sanitize tool arguments
     * - Inject default values
     * - Transform arguments
     * - Log tool invocations
     * - Implement rate limiting
     *
     * @example
     * ```typescript
     * async 'tool.execute.before'(input, output) {
     *   // Sanitize file paths
     *   if (input.tool === 'read' && output.args.filePath) {
     *     output.args.filePath = path.normalize(output.args.filePath)
     *   }
     *
     *   // Add default timeout
     *   if (input.tool === 'sh' && !output.args.timeout) {
     *     output.args.timeout = 30000
     *   }
     *
     *   // Log tool usage
     *   await logToolUsage(input.tool, output.args)
     * }
     * ```
     */
    async 'tool.execute.before'(input, output) {
      // console.log('[skeleton-plugin] tool.execute.before:', input)
      // console.log('[skeleton-plugin] tool.execute.before args:', output.args)
      // Example: Inject defaults
      // if (input.tool === 'sh' && !output.args.timeout) {
      //   output.args.timeout = 30000
      // }
    },

    /**
     * tool.execute.after Hook
     * -----------------------
     * Intercept tool results after execution.
     * Allows modification of tool output, title, and metadata.
     *
     * @lifecycle Called after tool.execute() completes successfully
     * @input tool name, sessionID, callID
     * @output Mutable: title, output (string), metadata (any)
     *
     * @useCases
     * - Transform or filter tool output
     * - Add metadata for display
     * - Log tool results
     * - Implement caching
     * - Truncate large outputs
     *
     * @example
     * ```typescript
     * async 'tool.execute.after'(input, output) {
     *   // Truncate very long outputs
     *   if (output.output.length > 50000) {
     *     output.output = output.output.slice(0, 50000) + '\n...[truncated]'
     *   }
     *
     *   // Add execution time to metadata
     *   output.metadata.executedAt = new Date().toISOString()
     *
     *   // Log results
     *   await logToolResult(input.tool, output.output.length)
     * }
     * ```
     */
    async 'tool.execute.after'(input, output) {
      // console.log('[skeleton-plugin] tool.execute.after:', input)
      // console.log('[skeleton-plugin] tool.execute.after output:', output.output.substring(0, 100))
      // Example: Add metadata
      // output.metadata.processedBy = 'skeleton-plugin'
      // Example: Truncate output
      // const MAX_LENGTH = 100000
      // if (output.output.length > MAX_LENGTH) {
      //   output.output = output.output.slice(0, MAX_LENGTH) + '\n...[truncated by plugin]'
      // }
    },

    // =========================================================================
    // EXPERIMENTAL HOOKS
    // =========================================================================

    /**
     * experimental.chat.messages.transform Hook
     * -----------------------------------------
     * Transform the entire message history before sending to LLM.
     * Allows deep modification of conversation context.
     *
     * @lifecycle Called when preparing messages for LLM request
     * @input Empty object (reserved for future use)
     * @output Mutable: messages (array of { info: Message, parts: Part[] })
     *
     * WARNING: This is an experimental API and may change.
     *
     * @useCases
     * - Implement custom context windowing
     * - Filter sensitive information from history
     * - Inject synthetic messages
     * - Modify conversation flow
     *
     * @example
     * ```typescript
     * async 'experimental.chat.messages.transform'(input, output) {
     *   // Filter out messages older than 1 hour
     *   const oneHourAgo = Date.now() - 3600000
     *   output.messages = output.messages.filter(
     *     msg => msg.info.time.created > oneHourAgo
     *   )
     *
     *   // Remove sensitive data from messages
     *   for (const msg of output.messages) {
     *     for (const part of msg.parts) {
     *       if (part.type === 'text') {
     *         part.text = part.text.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED]')
     *       }
     *     }
     *   }
     * }
     * ```
     */
    async 'experimental.chat.messages.transform'(input, output) {
      // console.log('[skeleton-plugin] experimental.chat.messages.transform')
      // console.log('[skeleton-plugin] messages count:', output.messages.length)
      // Example: Filter or transform messages
      // output.messages = output.messages.filter(m => !m.info.system)
    },

    /**
     * experimental.chat.system.transform Hook
     * ---------------------------------------
     * Transform the system prompt before sending to LLM.
     * Allows modification of the base instructions.
     *
     * @lifecycle Called when preparing system prompt for LLM request
     * @input sessionID
     * @output Mutable: system (string[])
     *
     * WARNING: This is an experimental API and may change.
     *
     * @useCases
     * - Inject custom instructions
     * - Add project-specific context
     * - Implement dynamic prompts
     * - Add persona/role information
     *
     * @example
     * ```typescript
     * async 'experimental.chat.system.transform'(input, output) {
     *   // Add project-specific instructions
     *   output.system.push(`
     *     Project-specific guidelines:
     *     - Use TypeScript for all new files
     *     - Follow the existing code style
     *     - Write tests for new functionality
     *   `)
     *
     *   // Add current context
     *   output.system.push(`Current time: ${new Date().toISOString()}`)
     * }
     * ```
     */
    async 'experimental.chat.system.transform'(input, output) {
      // console.log('[skeleton-plugin] experimental.chat.system.transform:', input)
      // console.log('[skeleton-plugin] system parts:', output.system.length)
      // Example: Add custom instructions
      // output.system.push('Always respond in a friendly tone.')
    },

    /**
     * experimental.session.compacting Hook
     * ------------------------------------
     * Customize the session compaction process.
     * Called before compaction starts to modify the compaction prompt.
     *
     * @lifecycle Called when session reaches token limit and needs compaction
     * @input sessionID
     * @output Mutable: context (string[]), prompt (optional string)
     *
     * context: Additional strings appended to the default compaction prompt
     * prompt: If set, replaces the default compaction prompt entirely
     *
     * WARNING: This is an experimental API and may change.
     *
     * @useCases
     * - Add context for better compaction
     * - Customize compaction strategy
     * - Preserve specific information
     * - Implement custom summarization
     *
     * @example
     * ```typescript
     * async 'experimental.session.compacting'(input, output) {
     *   // Add context to preserve
     *   output.context.push('Important: Preserve all file paths mentioned.')
     *   output.context.push('Keep track of all error messages discussed.')
     *
     *   // Or replace the entire prompt
     *   // output.prompt = 'Summarize this conversation focusing on code changes...'
     * }
     * ```
     */
    async 'experimental.session.compacting'(input, output) {
      // console.log('[skeleton-plugin] experimental.session.compacting:', input)
      // Example: Add context for compaction
      // output.context.push('Preserve all mentioned file paths and error messages.')
    },

    /**
     * experimental.text.complete Hook
     * -------------------------------
     * Modify text content after completion.
     * Called when a text part is completed.
     *
     * @lifecycle Called when a text part finishes streaming
     * @input sessionID, messageID, partID
     * @output Mutable: text (string)
     *
     * WARNING: This is an experimental API and may change.
     *
     * @useCases
     * - Post-process LLM output
     * - Fix formatting issues
     * - Inject additional content
     * - Implement content filtering
     *
     * @example
     * ```typescript
     * async 'experimental.text.complete'(input, output) {
     *   // Fix common formatting issues
     *   output.text = output.text.replace(/```(\w+)\n\n/g, '```$1\n')
     *
     *   // Add attribution
     *   if (output.text.includes('Reference:')) {
     *     output.text += '\n\n---\n*Generated by OpenCode*'
     *   }
     * }
     * ```
     */
    async 'experimental.text.complete'(input, output) {
      // console.log('[skeleton-plugin] experimental.text.complete:', input)
      // console.log('[skeleton-plugin] text length:', output.text.length)
      // Example: Post-process text
      // output.text = output.text.trim()
    },
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default SkeletonPlugin
