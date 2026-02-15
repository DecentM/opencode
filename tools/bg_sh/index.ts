export {
  closeDatabase,
  countTasksByStatus,
  createTask,
  deleteOldTasks,
  getDb,
  getNextPendingTask,
  getTask,
  initDatabase,
  listTasks,
  markRunningAsCrashed,
  resetQueuedToPending,
  updateTaskStatus,
} from './db'

export { getManager } from './manager'

export type {
  ActionType,
  ActiveWorker,
  BgShAction,
  CancelAction,
  CancelResult,
  CleanupAction,
  CleanupResult,
  GetResultAction,
  GetResultResult,
  ListAction,
  ListResult,
  StatusAction,
  StatusResult,
  SubmitAction,
  SubmitResult,
  Task,
  TaskRow,
  TaskStatus,
} from './types'

export { cancelTask, ensureLogsDir, executeTask, getLogPaths, getLogsDir } from './worker'
export type { WorkerResult } from './worker'
