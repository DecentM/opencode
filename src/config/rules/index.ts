export type { RuleContext, RuleDefinition } from './types'
export { ALL_RULE } from './all'
export { STYLE_RULE } from './style'

import { ALL_RULE } from './all'
import { STYLE_RULE } from './style'
import type { RuleDefinition } from './types'

export const ALL_RULES: RuleDefinition[] = [ALL_RULE, STYLE_RULE]

export const getRuleNames = (): string[] => ALL_RULES.map((r) => r.name)
