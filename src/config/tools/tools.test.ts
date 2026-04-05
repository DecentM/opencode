import { describe, expect, it } from 'bun:test'

import { ALL_TOOLS, resolveTools } from './index'

// --- ALL_TOOLS ---

describe('ALL_TOOLS', () => {
  const EXPECTED_TOOL_NAMES = [
    'node',
    'python',
    'tesseract',
    'time',
    'github',
    'pw',
    'jira',
    'notion',
    'sentry',
    'slack',
    'figma',
  ]

  it('contains all expected tool names', () => {
    expect(Object.keys(ALL_TOOLS).sort()).toEqual(EXPECTED_TOOL_NAMES.sort())
  })

  it('has 11 tools total', () => {
    expect(Object.keys(ALL_TOOLS).length).toBe(11)
  })

  it('plugin tools have kind "plugin"', () => {
    const pluginNames = ['node', 'python', 'tesseract', 'time']

    for (const name of pluginNames) {
      expect(ALL_TOOLS[name].kind).toBe('plugin')
    }
  })

  it('mcp tools have kind "mcp"', () => {
    const mcpNames = ['github', 'pw', 'jira', 'notion', 'sentry', 'slack', 'figma']

    for (const name of mcpNames) {
      expect(ALL_TOOLS[name].kind).toBe('mcp')
    }
  })

  it('every tool has a non-empty prompt', () => {
    for (const [_name, tool] of Object.entries(ALL_TOOLS)) {
      expect(tool.prompt.length).toBeGreaterThan(0)
    }
  })

  it('every tool has a non-empty permission map', () => {
    for (const [_name, tool] of Object.entries(ALL_TOOLS)) {
      expect(Object.keys(tool.permission).length).toBeGreaterThan(0)
    }
  })
})

// --- resolveTools ---

describe('resolveTools', () => {
  it('returns enabled for tools in the enabled set', () => {
    const enabled = new Set(['node', 'python'])
    const result = resolveTools(['node', 'python'], enabled)

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.enabled)).toBe(true)
  })

  it('returns disabled for tools not in the enabled set', () => {
    const enabled = new Set<string>()
    const result = resolveTools(['github', 'time'], enabled)

    expect(result).toHaveLength(2)
    expect(result.every((r) => !r.enabled)).toBe(true)
  })

  it('returns enabled for MCP tools when in the enabled set', () => {
    const enabled = new Set(['github'])
    const result = resolveTools(['github'], enabled)

    expect(result).toHaveLength(1)
    expect(result[0].enabled).toBe(true)
  })

  it('returns disabled for MCP tools when not in the enabled set', () => {
    const enabled = new Set<string>()
    const result = resolveTools(['github'], enabled)

    expect(result).toHaveLength(1)
    expect(result[0].enabled).toBe(false)
  })

  it('filters out unknown tool names', () => {
    const enabled = new Set(['node'])
    const result = resolveTools(['nonexistent', 'node'], enabled)

    expect(result).toHaveLength(1) // only node, nonexistent is filtered out
  })

  it('handles mixed plugin and MCP tools', () => {
    const enabled = new Set(['github', 'time'])
    const result = resolveTools(['github', 'time', 'sentry'], enabled)

    expect(result).toHaveLength(3)
    expect(result[0].enabled).toBe(true) // github (in set)
    expect(result[1].enabled).toBe(true) // time (in set)
    expect(result[2].enabled).toBe(false) // sentry (not in set)
  })

  it('returns empty array for empty input', () => {
    const result = resolveTools([], new Set())

    expect(result).toHaveLength(0)
  })
})

// --- Tool instructions ---

describe('tool instructions', () => {
  it('node tool has instructions', () => {
    expect(ALL_TOOLS.node.instructions).toBeDefined()
  })

  it('python tool has instructions', () => {
    expect(ALL_TOOLS.python.instructions).toBeDefined()
  })

  it('pw tool has instructions', () => {
    expect(ALL_TOOLS.pw.instructions).toBeDefined()
  })

  it('time tool has instructions', () => {
    expect(ALL_TOOLS.time.instructions).toBeDefined()
  })
})
