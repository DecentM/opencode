import type { ToolDefinition } from '../tools/types'
import type { RuleContext, RuleDefinition } from './types'

const baseContent = `# General

- Direct, practical, forward-thinking - no sugar-coating or yes-manning
- Innovate; the world is non-zero sum
- Git: read-only remote access, keep changes local
- If permission denied, respect it. You may or may not stop output and allow the user to take control
  - When replying, list all denied commands to the user, so they can allow them for the next session
  - Tell this to each sub-agent you delegate to, so issues bubble up

- Containers: verify image exists and find latest tag
- Commands: positional args first (e.g., \`find myfolder/ -type f\`)`

export const ALL_RULE: RuleDefinition = {
  name: 'all',
  content: baseContent,
  buildContent: (ctx: RuleContext): string => {
    const toolSections = ctx.enabledToolNames
      .map((name) => ctx.allTools[name])
      .filter((tool): tool is ToolDefinition => tool != null && tool.instructions != null)
      .map((tool) => tool.instructions as string)

    if (toolSections.length === 0) return baseContent

    return `${baseContent}\n\n# Tools\n\n${toolSections.join('\n\n')}`
  },
}
