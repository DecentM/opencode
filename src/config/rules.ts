import type { RuleContext, RuleDefinition } from './rules/index'
import { ALL_RULES } from './rules/index'

// Returns enabled rule definitions, sorted by name, filtered by the enabled set.
// When a rule has buildContent, it is called with the tool context to produce
// the final content string.
export const loadRules = (enabledRuleNames: Set<string>, ctx: RuleContext): RuleDefinition[] =>
  ALL_RULES.filter((r) => enabledRuleNames.has(r.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({
      ...r,
      content: r.buildContent ? r.buildContent(ctx) : r.content,
    }))
