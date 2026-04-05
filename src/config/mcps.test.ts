import { describe, expect, it } from 'bun:test'

import { buildMcps } from './mcps'

// --- buildMcps ---

describe('buildMcps', () => {
  it('does not include time (now a plugin tool)', () => {
    const mcps = buildMcps(new Set(['time']))

    expect(mcps.time).toBeUndefined()
  })

  it('includes github when enabled', () => {
    const mcps = buildMcps(new Set(['github']))

    expect(mcps.github).toBeDefined()
    expect(mcps.github.type).toBe('remote')

    if (mcps.github.type === 'remote') {
      expect(mcps.github.url).toBe('https://api.githubcopilot.com/mcp')
      expect(mcps.github.headers?.Authorization).toBe('Bearer {env:GITHUB_TOKEN}')
    }
  })

  it('excludes github when not in enabled set', () => {
    const mcps = buildMcps(new Set())

    expect(mcps.github).toBeUndefined()
  })

  it('excludes pw when not in enabled set', () => {
    const mcps = buildMcps(new Set())

    expect(mcps.pw).toBeUndefined()
  })

  it('includes jira when enabled', () => {
    const mcps = buildMcps(new Set(['jira']))

    expect(mcps.jira).toBeDefined()

    if (mcps.jira.type === 'remote') {
      expect(mcps.jira.url).toBe('https://mcp.atlassian.com/v1/mcp')
    }
  })

  it('includes notion when enabled', () => {
    const mcps = buildMcps(new Set(['notion']))

    expect(mcps.notion).toBeDefined()

    if (mcps.notion.type === 'remote') {
      expect(mcps.notion.url).toBe('https://mcp.notion.com/mcp')
    }
  })

  it('includes sentry when enabled', () => {
    const mcps = buildMcps(new Set(['sentry']))

    expect(mcps.sentry).toBeDefined()

    if (mcps.sentry.type === 'remote') {
      expect(mcps.sentry.url).toBe('https://mcp.sentry.dev/mcp')
    }
  })

  it('includes all MCPs when all are enabled', () => {
    const mcps = buildMcps(new Set(['github', 'pw', 'jira', 'notion', 'sentry', 'slack', 'figma']))

    expect(Object.keys(mcps).sort()).toEqual(
      ['figma', 'github', 'jira', 'notion', 'pw', 'sentry', 'slack'].sort()
    )
  })

  it('returns empty when no MCPs are enabled', () => {
    const mcps = buildMcps(new Set())

    expect(Object.keys(mcps)).toEqual([])
  })
})
