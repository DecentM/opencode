/**
 * Constraint validators for the gns tool.
 */

import {
  validateYamlConfig as baseValidateYamlConfig,
  simplePatternToRegex,
} from '../../lib/permissions'
import type { ConstraintConfig, ConstraintResult, ConstraintType, PermissionPattern } from './types'

// =============================================================================
// Pattern Matching Utilities
// =============================================================================

/**
 * Convert a glob pattern to a regex.
 * Supports * as wildcard (matches any characters).
 */
export const patternToRegex = simplePatternToRegex

/**
 * Check if a value matches any of the given glob patterns.
 */
export const matchesAnyPattern = (value: string, patterns: string[]): boolean => {
  for (const pattern of patterns) {
    if (patternToRegex(pattern).test(value)) {
      return true
    }
  }
  return false
}

// =============================================================================
// YAML Schema Validation
// =============================================================================

/**
 * Validate a constraint configuration.
 * Returns an error message if invalid, undefined if valid.
 */
export const validateConstraint = (
  c: unknown,
  index: number,
  ruleIndex: number
): string | undefined => {
  if (typeof c === 'string') {
    const validTypes: ConstraintType[] = ['keyspace_pattern', 'no_force', 'dry_run_only']
    if (!validTypes.includes(c as ConstraintType)) {
      return `Rule ${ruleIndex}: Invalid constraint type '${c}'`
    }
    // String shorthand for keyspace_pattern is invalid (needs params)
    if (c === 'keyspace_pattern') {
      return `Rule ${ruleIndex}: Constraint '${c}' requires object form with parameters`
    }
    return undefined
  }

  if (typeof c !== 'object' || c === null) {
    return `Rule ${ruleIndex}: Constraint ${index} must be a string or object`
  }

  const obj = c as Record<string, unknown>
  if (typeof obj.type !== 'string') {
    return `Rule ${ruleIndex}: Constraint ${index} missing 'type' field`
  }

  switch (obj.type) {
    case 'no_force':
    case 'dry_run_only':
      break
    case 'keyspace_pattern':
      if (!Array.isArray(obj.value) || !obj.value.every((v) => typeof v === 'string')) {
        return `Rule ${ruleIndex}: keyspace_pattern requires 'value' as string array`
      }
      break
    default:
      return `Rule ${ruleIndex}: Unknown constraint type '${obj.type}'`
  }

  return undefined
}

/**
 * Validate constraints array for a rule.
 * Returns an error message if invalid, undefined if valid.
 */
const validateConstraintsArray = (
  constraints: unknown[],
  ruleIndex: number
): string | undefined => {
  for (let i = 0; i < constraints.length; i++) {
    const err = validateConstraint(constraints[i], i, ruleIndex)
    if (err) return err
  }
  return undefined
}

/**
 * Validate a single YAML rule.
 * Returns an error message if invalid, undefined if valid.
 */
export const validateYamlRule = (rule: unknown, index: number): string | undefined => {
  if (typeof rule !== 'object' || rule === null) {
    return `Rule ${index}: Must be an object`
  }

  const r = rule as Record<string, unknown>

  // Must have pattern or patterns
  const hasPattern = typeof r.pattern === 'string'
  const hasPatterns = Array.isArray(r.patterns) && r.patterns.every((p) => typeof p === 'string')
  if (!hasPattern && !hasPatterns) {
    return `Rule ${index}: Must have 'pattern' (string) or 'patterns' (string array)`
  }

  // Must have valid decision
  if (r.decision !== 'allow' && r.decision !== 'deny') {
    return `Rule ${index}: 'decision' must be 'allow' or 'deny'`
  }

  // Reason is optional but must be string or null
  if (r.reason !== undefined && r.reason !== null && typeof r.reason !== 'string') {
    return `Rule ${index}: 'reason' must be a string or null`
  }

  // Validate constraints array
  if (r.constraints !== undefined) {
    if (!Array.isArray(r.constraints)) {
      return `Rule ${index}: 'constraints' must be an array`
    }
    for (let i = 0; i < r.constraints.length; i++) {
      const err = validateConstraint(r.constraints[i], i, index)
      if (err) return err
    }
  }

  return undefined
}

/**
 * Validate the entire YAML config structure.
 * Returns array of error messages (empty if valid).
 */
export const validateYamlConfig = (parsed: unknown): string[] => {
  return baseValidateYamlConfig<ConstraintConfig>(parsed, validateConstraintsArray)
}

// =============================================================================
// Constraint Validators
// =============================================================================

/**
 * Validate that a key matches allowed keyspace patterns.
 */
export const validateKeyspacePattern = (
  key: string | null,
  allowedPatterns: string[]
): ConstraintResult => {
  // If no key provided, we can't validate - allow it to proceed
  // The actual GNS operation will fail if a key is required
  if (!key) {
    return { valid: true }
  }

  if (!matchesAnyPattern(key, allowedPatterns)) {
    return {
      valid: false,
      violation: `Operation denied: Key '${key}' not in allowed keyspaces. Allowed: ${allowedPatterns.join(', ')}`,
    }
  }
  return { valid: true }
}

/**
 * Check if args contain a specific flag.
 */
const hasFlag = (args: string[], flag: string): boolean => {
  return args.some((arg) => arg === flag || arg === `--${flag}` || arg === `-${flag.charAt(0)}`)
}

/**
 * Validate that the args don't contain --force flag.
 */
export const validateNoForce = (args: string[]): ConstraintResult => {
  if (hasFlag(args, 'force') || hasFlag(args, '-f') || args.includes('--force')) {
    return {
      valid: false,
      violation: 'Operation denied: --force flag is not allowed',
    }
  }
  return { valid: true }
}

/**
 * Validate that the args contain --dry-run flag.
 */
export const validateDryRunOnly = (args: string[]): ConstraintResult => {
  if (!hasFlag(args, 'dry-run') && !args.includes('--dry-run')) {
    return {
      valid: false,
      violation: 'Operation denied: --dry-run flag is required for this operation',
    }
  }
  return { valid: true }
}

// =============================================================================
// Main Constraint Validation
// =============================================================================

export interface ValidationContext {
  key?: string | null
  args?: string[]
}

/**
 * Validate all constraints for a matched rule.
 */
export const validateConstraints = (
  rule: PermissionPattern,
  context: ValidationContext
): ConstraintResult => {
  // If no constraints, allow
  if (!rule.constraints || rule.constraints.length === 0) {
    return { valid: true }
  }

  // Validate each constraint - ALL must pass
  for (const c of rule.constraints) {
    const type = typeof c === 'string' ? c : c.type
    let result: ConstraintResult

    switch (type) {
      case 'keyspace_pattern': {
        if (typeof c === 'object' && c.type === 'keyspace_pattern' && context.key !== undefined) {
          result = validateKeyspacePattern(context.key, c.value)
        } else {
          result = { valid: true }
        }
        break
      }

      case 'no_force': {
        if (context.args) {
          result = validateNoForce(context.args)
        } else {
          result = { valid: true }
        }
        break
      }

      case 'dry_run_only': {
        if (context.args) {
          result = validateDryRunOnly(context.args)
        } else {
          result = {
            valid: false,
            violation: 'Operation denied: --dry-run flag is required for this operation',
          }
        }
        break
      }

      default:
        result = {
          valid: false,
          violation: `Operation denied: Unknown constraint type '${type}'`,
        }
    }

    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}
