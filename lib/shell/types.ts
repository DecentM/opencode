export interface KillableProcess {
  /** Send a signal to the process */
  kill(signal?: NodeJS.Signals | number): void
  /** Promise that resolves when the process exits */
  exited: Promise<number>
}

export interface WorkdirValidationOptions {
  /** The root directory that workdir must be under (defaults to process.cwd()) */
  allowedRoot?: string
  /** Whether to allow workdir to exactly match the allowed root (default: true) */
  allowRootMatch?: boolean
}
