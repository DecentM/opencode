/**
 * Type definitions for the gns tool.
 */

import type {
  CompiledPermissionPattern as BaseCompiledPermissionPattern,
  ConstraintResult as BaseConstraintResult,
  Decision as BaseDecision,
  MatchResult as BaseMatchResult,
  PermissionPattern as BasePermissionPattern,
  PermissionsConfig as BasePermissionsConfig,
  YamlRule as BaseYamlRule,
} from '../../lib/permissions'

// =============================================================================
// Core Types (re-exported from shared library)
// =============================================================================

export type Decision = BaseDecision
export type ConstraintResult = BaseConstraintResult

// =============================================================================
// GNS Operations
// =============================================================================

/**
 * GNS command categories.
 */
export type GnsCommandCategory =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'auth'
  | 'config'
  | 'mount'
  | 'type'
  | 'dangerous'

/**
 * Full operation pattern, e.g., "get", "set user.josh.test", "auth status"
 */
export type OperationPattern = string

// =============================================================================
// Constraint Types (gns-specific)
// =============================================================================

export type ConstraintType = 'keyspace_pattern' | 'no_force' | 'dry_run_only'

export interface KeyspacePatternConstraint {
  type: 'keyspace_pattern'
  value: string[]
}

export interface NoForceConstraint {
  type: 'no_force'
}

export interface DryRunOnlyConstraint {
  type: 'dry_run_only'
}

export type ConstraintConfig =
  | ConstraintType // String shorthand: "no_force"
  | KeyspacePatternConstraint
  | NoForceConstraint
  | DryRunOnlyConstraint

// =============================================================================
// Permission Pattern Types (specialized from shared library)
// =============================================================================

export type PermissionPattern = BasePermissionPattern<ConstraintConfig>
export type CompiledPermissionPattern = BaseCompiledPermissionPattern<ConstraintConfig>
export type PermissionsConfig = BasePermissionsConfig<ConstraintConfig>
export type MatchResult = BaseMatchResult<ConstraintConfig>
export type YamlRule = BaseYamlRule<ConstraintConfig>

// =============================================================================
// Logging Types
// =============================================================================

export interface LogEntry {
  sessionId?: string
  messageId?: string
  command: string
  args?: string[]
  patternMatched: string | null
  decision: Decision
  resultSummary?: string
  durationMs?: number
}
