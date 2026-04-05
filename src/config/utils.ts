import type { PermissionMap } from './types'

type PermissionValue = 'allow' | 'deny'

// Deep merge two permission maps — second wins on conflicts
export const mergePermissions = (base: PermissionMap, override: PermissionMap): PermissionMap => {
  const result: PermissionMap = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (typeof value === 'object' && typeof result[key] === 'object' && !Array.isArray(value)) {
      result[key] = { ...(result[key] as Record<string, PermissionValue>), ...value }
    } else {
      result[key] = value
    }
  }

  return result
}
