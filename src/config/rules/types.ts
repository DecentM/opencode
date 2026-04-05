import type { ToolDefinition } from '../tools/types'

export type RuleContext = {
  enabledToolNames: string[]
  allTools: Record<string, ToolDefinition>
}

export type RuleDefinition = {
  name: string
  // Static content. If buildContent is present, this is the base — buildContent
  // appends to or replaces sections of it.
  content: string
  // Optional: called at load time to produce the final content string.
  // Receives the enabled tool context. If absent, content is used as-is.
  buildContent?: (ctx: RuleContext) => string
}
