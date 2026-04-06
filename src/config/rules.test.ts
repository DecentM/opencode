import { describe, expect, it } from 'bun:test'

import { loadRules } from './rules'
import type { RuleContext } from './rules/index'
import { ALL_TOOLS } from './tools/index'

const makeCtx = (enabledToolNames: string[] = []): RuleContext => ({
  enabledToolNames,
  allTools: ALL_TOOLS,
})

describe('loadRules', () => {
  it('returns definitions for enabled rules', () => {
    const rules = loadRules(new Set(['all', 'style']), makeCtx())
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.every((r) => r.content.length > 0)).toBe(true)
  })

  it('excludes disabled rules', () => {
    const rules = loadRules(new Set(['style']), makeCtx())
    expect(rules.every((r) => r.name !== 'all')).toBe(true)
  })

  it('returns empty when no rules are enabled', () => {
    const rules = loadRules(new Set(), makeCtx())
    expect(rules).toEqual([])
  })

  it('returns all rules when all names are in the set', () => {
    const rules = loadRules(new Set(['all', 'style']), makeCtx())
    expect(rules.length).toBe(2)
    expect(rules.some((r) => r.name === 'all')).toBe(true)
    expect(rules.some((r) => r.name === 'style')).toBe(true)
  })

  it('returns rules sorted by name', () => {
    const rules = loadRules(new Set(['style', 'all']), makeCtx())
    expect(rules[0].name).toBe('all')
    expect(rules[1].name).toBe('style')
  })

  it('all rule omits sh instructions when sh is disabled', () => {
    const rules = loadRules(new Set(['all']), makeCtx([]))
    const allRule = rules.find((r) => r.name === 'all')

    if (allRule == null) throw new Error('expected all rule')

    expect(allRule.content).not.toContain('## sh (shell commands)')
  })

  it('all rule includes pw instructions when pw is enabled', () => {
    const rules = loadRules(new Set(['all']), makeCtx(['pw']))
    const allRule = rules.find((r) => r.name === 'all')

    if (allRule == null) throw new Error('expected all rule')

    expect(allRule.content).toContain('## browser_* (browser automation)')
    expect(allRule.content).toContain('# Tools')
  })

  it('style rule content is unaffected by enabled tools', () => {
    const rulesNoTools = loadRules(new Set(['style']), makeCtx([]))
    const rulesWithTools = loadRules(new Set(['style']), makeCtx(['node', 'pw']))
    const styleNoTools = rulesNoTools.find((r) => r.name === 'style')
    const styleWithTools = rulesWithTools.find((r) => r.name === 'style')

    if (styleNoTools == null || styleWithTools == null) {
      throw new Error('expected style rules')
    }

    expect(styleNoTools.content).toBe(styleWithTools.content)
  })
})
