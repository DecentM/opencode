/**
 * Permission loading and operation matching for the gns tool.
 */

import { join } from 'node:path'
import {
  createPatternMatcher,
  createPermissionLoader,
  simplePatternToRegex,
} from '../../lib/permissions'
import type { ConstraintConfig, MatchResult, PermissionsConfig } from './types'
import { validateYamlConfig } from './validators'

// =============================================================================
// Permission Loading
// =============================================================================

/**
 * Load permissions from YAML file.
 * Uses a singleton pattern to load only once.
 * Pre-compiles regexes for performance.
 *
 * Supports two rule formats:
 * 1. Single pattern:  { pattern: "get", decision: "allow" }
 * 2. Multi-pattern:   { patterns: ["get", "list"], decision: "allow" }
 */
export const getPermissions: () => PermissionsConfig = createPermissionLoader<ConstraintConfig>({
  yamlPath: join(import.meta.dir, '..', 'gns-permissions.yaml'),
  patternToRegex: simplePatternToRegex,
  validateConfig: validateYamlConfig,
  fallbackDefault: 'deny',
  fallbackDefaultReason: 'Permissions file failed to load - all operations denied for safety',
  logPrefix: '[gns]',
})

// =============================================================================
// Operation Matching
// =============================================================================

/**
 * Build an operation pattern string from command and args.
 * Examples:
 *   - "get"
 *   - "get user.josh.test"
 *   - "auth status"
 *   - "set user.josh.test value"
 */
export const buildOperationPattern = (command: string, args?: string[]): string => {
  if (!args || args.length === 0) return command
  return `${command} ${args.join(' ')}`
}

/**
 * Extract the key (first argument) from args for keyspace validation.
 * Returns null if no key is present.
 */
export const extractKey = (args?: string[]): string | null => {
  if (!args || args.length === 0) return null
  return args[0]
}

/**
 * Find the first matching permission pattern for an operation.
 * Uses pre-compiled regexes for performance.
 */
export const matchOperation: (operationPattern: string) => MatchResult =
  createPatternMatcher<ConstraintConfig>(getPermissions)
