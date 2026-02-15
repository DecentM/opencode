/**
 * Tests for the validators module.
 * Tests constraint validation functions.
 */

import { describe, expect, test } from 'bun:test'
import type { PermissionPattern } from './types'
import {
  matchesAnyPattern,
  validateConstraints,
  validateDryRunOnly,
  validateKeyspacePattern,
  validateNoForce,
} from './validators'

// =============================================================================
// matchesAnyPattern
// =============================================================================

describe('matchesAnyPattern', () => {
  test('matches exact pattern', () => {
    expect(matchesAnyPattern('user.josh.test', ['user.josh.test'])).toBe(true)
  })

  test('matches wildcard pattern', () => {
    expect(matchesAnyPattern('user.josh.test', ['user.*'])).toBe(true)
    expect(matchesAnyPattern('projects.chess.config', ['projects.*'])).toBe(true)
  })

  test('matches one of multiple patterns', () => {
    expect(matchesAnyPattern('ai.memory.context', ['user.*', 'ai.*', 'gns.*'])).toBe(true)
  })

  test('returns false when no pattern matches', () => {
    expect(matchesAnyPattern('system.config', ['user.*', 'projects.*'])).toBe(false)
  })

  test('handles complex patterns', () => {
    expect(matchesAnyPattern('user.josh.ai.memory', ['user.*.ai.*'])).toBe(true)
  })
})

// =============================================================================
// validateKeyspacePattern
// =============================================================================

describe('validateKeyspacePattern', () => {
  const allowedPatterns = ['user.*', 'projects.*', 'ai.*', 'gns.*']

  describe('allows keys in allowed keyspaces', () => {
    test('allows user.* keys', () => {
      const result = validateKeyspacePattern('user.josh.test', allowedPatterns)
      expect(result.valid).toBe(true)
    })

    test('allows projects.* keys', () => {
      const result = validateKeyspacePattern('projects.chess.config', allowedPatterns)
      expect(result.valid).toBe(true)
    })

    test('allows ai.* keys', () => {
      const result = validateKeyspacePattern('ai.memory.context', allowedPatterns)
      expect(result.valid).toBe(true)
    })

    test('allows gns.* keys', () => {
      const result = validateKeyspacePattern('gns.schema.types', allowedPatterns)
      expect(result.valid).toBe(true)
    })
  })

  describe('denies keys outside allowed keyspaces', () => {
    test('denies system.* keys', () => {
      const result = validateKeyspacePattern('system.config', allowedPatterns)
      expect(result.valid).toBe(false)
      expect(result.violation).toContain('not in allowed keyspaces')
    })

    test('denies root keys', () => {
      const result = validateKeyspacePattern('config', allowedPatterns)
      expect(result.valid).toBe(false)
    })

    test('denies admin.* keys', () => {
      const result = validateKeyspacePattern('admin.users.list', allowedPatterns)
      expect(result.valid).toBe(false)
    })
  })

  describe('handles null key', () => {
    test('allows null key (no validation possible)', () => {
      const result = validateKeyspacePattern(null, allowedPatterns)
      expect(result.valid).toBe(true)
    })
  })
})

// =============================================================================
// validateNoForce
// =============================================================================

describe('validateNoForce', () => {
  describe('denies force flag', () => {
    test('denies --force flag', () => {
      const result = validateNoForce(['key', 'value', '--force'])
      expect(result.valid).toBe(false)
      expect(result.violation).toContain('--force')
    })

    test('denies -f flag', () => {
      const result = validateNoForce(['key', 'value', '-f'])
      expect(result.valid).toBe(false)
    })
  })

  describe('allows commands without force', () => {
    test('allows normal command', () => {
      const result = validateNoForce(['user.josh.test', 'value'])
      expect(result.valid).toBe(true)
    })

    test('allows empty args', () => {
      const result = validateNoForce([])
      expect(result.valid).toBe(true)
    })

    test('allows other flags', () => {
      const result = validateNoForce(['--dry-run', 'key', 'value'])
      expect(result.valid).toBe(true)
    })
  })
})

// =============================================================================
// validateDryRunOnly
// =============================================================================

describe('validateDryRunOnly', () => {
  describe('requires dry-run flag', () => {
    test('allows command with --dry-run', () => {
      const result = validateDryRunOnly(['--dry-run', 'key', 'value'])
      expect(result.valid).toBe(true)
    })

    test('denies command without --dry-run', () => {
      const result = validateDryRunOnly(['key', 'value'])
      expect(result.valid).toBe(false)
      expect(result.violation).toContain('--dry-run')
    })

    test('denies empty args', () => {
      const result = validateDryRunOnly([])
      expect(result.valid).toBe(false)
    })
  })
})

// =============================================================================
// validateConstraints
// =============================================================================

describe('validateConstraints', () => {
  describe('with no constraints', () => {
    test('allows operation when rule has no constraints', () => {
      const rule: PermissionPattern = {
        pattern: 'get*',
        decision: 'allow',
      }
      const result = validateConstraints(rule, { key: 'user.test', args: [] })
      expect(result.valid).toBe(true)
    })
  })

  describe('with keyspace_pattern constraint', () => {
    const rule: PermissionPattern = {
      pattern: 'set*',
      decision: 'allow',
      constraints: [
        {
          type: 'keyspace_pattern',
          value: ['user.*', 'projects.*', 'ai.*', 'gns.*'],
        },
      ],
    }

    test('allows key in allowed keyspace', () => {
      const result = validateConstraints(rule, { key: 'user.josh.test', args: [] })
      expect(result.valid).toBe(true)
    })

    test('denies key outside allowed keyspace', () => {
      const result = validateConstraints(rule, { key: 'system.config', args: [] })
      expect(result.valid).toBe(false)
    })
  })

  describe('with no_force constraint', () => {
    const rule: PermissionPattern = {
      pattern: 'set*',
      decision: 'allow',
      constraints: ['no_force'],
    }

    test('allows command without force flag', () => {
      const result = validateConstraints(rule, {
        key: 'user.test',
        args: ['user.test', 'value'],
      })
      expect(result.valid).toBe(true)
    })

    test('denies command with force flag', () => {
      const result = validateConstraints(rule, {
        key: 'user.test',
        args: ['user.test', 'value', '--force'],
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('with dry_run_only constraint', () => {
    const rule: PermissionPattern = {
      pattern: 'dangerous-op*',
      decision: 'allow',
      constraints: ['dry_run_only'],
    }

    test('allows command with dry-run flag', () => {
      const result = validateConstraints(rule, {
        key: 'test',
        args: ['--dry-run', 'test'],
      })
      expect(result.valid).toBe(true)
    })

    test('denies command without dry-run flag', () => {
      const result = validateConstraints(rule, {
        key: 'test',
        args: ['test'],
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('with multiple constraints', () => {
    const rule: PermissionPattern = {
      pattern: 'set*',
      decision: 'allow',
      constraints: [
        {
          type: 'keyspace_pattern',
          value: ['user.*', 'projects.*'],
        },
        'no_force',
      ],
    }

    test('allows when all constraints pass', () => {
      const result = validateConstraints(rule, {
        key: 'user.josh.test',
        args: ['user.josh.test', 'value'],
      })
      expect(result.valid).toBe(true)
    })

    test('denies when keyspace fails', () => {
      const result = validateConstraints(rule, {
        key: 'system.config',
        args: ['system.config', 'value'],
      })
      expect(result.valid).toBe(false)
      expect(result.violation).toContain('keyspace')
    })

    test('denies when no_force fails', () => {
      const result = validateConstraints(rule, {
        key: 'user.josh.test',
        args: ['user.josh.test', 'value', '--force'],
      })
      expect(result.valid).toBe(false)
      expect(result.violation).toContain('--force')
    })
  })

  describe('error handling', () => {
    test('errors on unknown constraint type', () => {
      const rule: PermissionPattern = {
        pattern: 'test*',
        decision: 'allow',
        constraints: ['unknown_constraint' as any],
      }
      const result = validateConstraints(rule, { key: 'test', args: [] })
      expect(result.valid).toBe(false)
      expect(result.violation).toContain('Unknown constraint type')
    })

    test('keyspace_pattern as string shorthand passes through at runtime (caught by YAML validation)', () => {
      // Note: keyspace_pattern requires object form with value array.
      // The YAML validator catches this error during loading.
      // At runtime, if somehow the string form gets through, it's treated as
      // "no constraint to check" (graceful fallback) rather than an error.
      const rule: PermissionPattern = {
        pattern: 'test*',
        decision: 'allow',
        constraints: ['keyspace_pattern'], // Invalid - requires object form
      }
      // At runtime, string 'keyspace_pattern' matches the case but fails the
      // object type check, so it falls through to valid: true (lenient)
      const result = validateConstraints(rule, { key: 'user.test', args: [] })
      // Runtime is lenient - the YAML validation is the guard
      expect(result.valid).toBe(true)
    })
  })
})
