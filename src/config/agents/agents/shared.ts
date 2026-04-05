export const READ_DENY_ENV = {
  '*': 'allow',
  '.env': 'deny',
  '.env.*': 'deny',
  '.env.example': 'allow',
} as const

export const EDIT_DENY_ENV = {
  '*': 'allow',
  '.env': 'deny',
  '.env.*': 'deny',
  '.env.example': 'allow',
} as const
