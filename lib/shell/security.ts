import path from 'node:path'
import type { WorkdirValidationOptions } from './types'

export const validateWorkdir = (workdir: string, options: WorkdirValidationOptions = {}): void => {
  const { allowedRoot = process.cwd(), allowRootMatch = true } = options

  // Check if workdir is under allowedRoot
  const relative = path.relative(allowedRoot, workdir)
  const isSubdir = relative && !relative.startsWith('..') && !path.isAbsolute(relative)

  // Allow exact match if allowRootMatch is true
  if (allowRootMatch && workdir === allowedRoot) {
    return
  }

  if (!isSubdir) {
    throw new Error(`workdir must be under ${allowedRoot}`)
  }
}
