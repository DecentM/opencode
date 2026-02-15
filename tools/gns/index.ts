/**
 * Barrel file for gns tool modules.
 * Re-exports all public APIs from the gns tool.
 */

// Permissions
export {
  buildOperationPattern,
  extractKey,
  getPermissions,
  matchOperation,
} from './permissions'

// Types
export type {
  CompiledPermissionPattern,
  ConstraintConfig,
  ConstraintResult,
  ConstraintType,
  Decision,
  DryRunOnlyConstraint,
  GnsCommandCategory,
  KeyspacePatternConstraint,
  LogEntry,
  MatchResult,
  NoForceConstraint,
  OperationPattern,
  PermissionPattern,
  PermissionsConfig,
  YamlRule,
} from './types'

// Validators
export {
  matchesAnyPattern,
  patternToRegex,
  type ValidationContext,
  validateConstraint,
  validateConstraints,
  validateDryRunOnly,
  validateKeyspacePattern,
  validateNoForce,
  validateYamlConfig,
  validateYamlRule,
} from './validators'
