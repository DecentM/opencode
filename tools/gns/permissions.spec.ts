/**
 * Tests for the permissions module.
 * Tests operation matching against permission patterns.
 */

import { describe, expect, test } from 'bun:test'
import { buildOperationPattern, extractKey, matchOperation } from './permissions'

// =============================================================================
// buildOperationPattern
// =============================================================================

describe('buildOperationPattern', () => {
  test('returns command only when no args', () => {
    expect(buildOperationPattern('get')).toBe('get')
    expect(buildOperationPattern('list', [])).toBe('list')
  })

  test('combines command and args', () => {
    expect(buildOperationPattern('get', ['user.josh.test'])).toBe('get user.josh.test')
    expect(buildOperationPattern('set', ['user.josh.test', 'value'])).toBe(
      'set user.josh.test value'
    )
  })

  test('handles compound commands', () => {
    expect(buildOperationPattern('auth status')).toBe('auth status')
    expect(buildOperationPattern('type list', ['--format', 'json'])).toBe('type list --format json')
  })
})

// =============================================================================
// extractKey
// =============================================================================

describe('extractKey', () => {
  test('returns null when no args', () => {
    expect(extractKey()).toBeNull()
    expect(extractKey([])).toBeNull()
  })

  test('returns first argument as key', () => {
    expect(extractKey(['user.josh.test'])).toBe('user.josh.test')
    expect(extractKey(['projects.chess.config', 'value'])).toBe('projects.chess.config')
  })
})

// =============================================================================
// matchOperation
// =============================================================================

describe('matchOperation', () => {
  describe('read operations', () => {
    test('allows get command', () => {
      const result = matchOperation('get')
      expect(result.decision).toBe('allow')
      expect(result.pattern).not.toBeNull()
    })

    test('allows get with key', () => {
      const result = matchOperation('get user.josh.test')
      expect(result.decision).toBe('allow')
    })

    test('allows list command', () => {
      const result = matchOperation('list')
      expect(result.decision).toBe('allow')
    })

    test('allows search command', () => {
      const result = matchOperation('search pattern')
      expect(result.decision).toBe('allow')
    })

    test('allows auth status', () => {
      const result = matchOperation('auth status')
      expect(result.decision).toBe('allow')
    })

    test('allows type list', () => {
      const result = matchOperation('type list')
      expect(result.decision).toBe('allow')
    })

    test('allows config get', () => {
      const result = matchOperation('config get')
      expect(result.decision).toBe('allow')
    })

    test('allows version', () => {
      const result = matchOperation('version')
      expect(result.decision).toBe('allow')
    })

    test('allows help', () => {
      const result = matchOperation('help')
      expect(result.decision).toBe('allow')
    })
  })

  describe('write operations', () => {
    test('allows set command', () => {
      const result = matchOperation('set user.josh.test value')
      expect(result.decision).toBe('allow')
      expect(result.rule).toBeDefined()
      expect(result.rule?.constraints).toBeDefined()
    })

    test('allows link command', () => {
      const result = matchOperation('link')
      expect(result.decision).toBe('allow')
    })

    test('allows batch-set command', () => {
      const result = matchOperation('batch-set')
      expect(result.decision).toBe('allow')
    })
  })

  describe('delete operations', () => {
    test('denies delete command', () => {
      const result = matchOperation('delete user.josh.test')
      expect(result.decision).toBe('deny')
      expect(result.reason).toContain('user confirmation')
    })

    test('denies rm command', () => {
      const result = matchOperation('rm user.josh.test')
      expect(result.decision).toBe('deny')
    })

    test('denies batch-delete command', () => {
      const result = matchOperation('batch-delete')
      expect(result.decision).toBe('deny')
    })

    test('denies unlink command', () => {
      const result = matchOperation('unlink')
      expect(result.decision).toBe('deny')
    })
  })

  describe('admin operations', () => {
    test('denies admin acls', () => {
      const result = matchOperation('admin acls')
      expect(result.decision).toBe('deny')
      expect(result.reason).toContain('Admin operations')
    })

    test('denies admin tokens', () => {
      const result = matchOperation('admin tokens')
      expect(result.decision).toBe('deny')
    })

    test('allows admin stats', () => {
      const result = matchOperation('admin stats')
      expect(result.decision).toBe('allow')
    })
  })

  describe('auth operations', () => {
    test('allows auth status', () => {
      const result = matchOperation('auth status')
      expect(result.decision).toBe('allow')
    })

    test('denies auth login', () => {
      const result = matchOperation('auth login')
      expect(result.decision).toBe('deny')
      expect(result.reason).toContain('user action')
    })

    test('denies auth logout', () => {
      const result = matchOperation('auth logout')
      expect(result.decision).toBe('deny')
    })
  })

  describe('config operations', () => {
    test('allows config get', () => {
      const result = matchOperation('config get')
      expect(result.decision).toBe('allow')
    })

    test('allows config show', () => {
      const result = matchOperation('config show')
      expect(result.decision).toBe('allow')
    })

    test('denies config set', () => {
      const result = matchOperation('config set')
      expect(result.decision).toBe('deny')
    })
  })

  describe('dangerous operations', () => {
    test('denies update-where', () => {
      const result = matchOperation('update-where')
      expect(result.decision).toBe('deny')
      expect(result.reason).toContain('dangerous')
    })

    test('denies setup', () => {
      const result = matchOperation('setup')
      expect(result.decision).toBe('deny')
    })

    test('denies migrations', () => {
      const result = matchOperation('migrations')
      expect(result.decision).toBe('deny')
    })
  })

  describe('default behavior', () => {
    test('returns default deny for unknown command', () => {
      const result = matchOperation('someunknowncommand123')
      expect(result.decision).toBe('deny')
      expect(result.isDefault).toBe(true)
    })
  })

  describe('rule inclusion', () => {
    test('includes rule for constraint checking', () => {
      const result = matchOperation('set user.josh.test value')
      expect(result.rule).toBeDefined()
    })
  })
})
