export type TaskStatus =
  | 'PENDING' // Task created, waiting to be queued
  | 'QUEUED' // Task in queue, waiting for worker
  | 'RUNNING' // Task currently executing
  | 'COMPLETED' // Task finished successfully
  | 'FAILED' // Task finished with non-zero exit code
  | 'CANCELLED' // Task was cancelled by user
  | 'CRASHED' // Task was running when system crashed/restarted


export interface Task {
  id: string
  command: string
  workdir: string
  status: TaskStatus
  created_at: number // Unix timestamp in ms
  started_at: number | null
  finished_at: number | null
  exit_code: number | null
  timeout_ms: number
  priority: number
  log_path_out: string | null
  log_path_err: string | null
}

export interface TaskRow {
  id: string
  command: string
  workdir: string
  status: string
  created_at: number
  started_at: number | null
  finished_at: number | null
  exit_code: number | null
  timeout_ms: number
  priority: number
  log_path_out: string | null
  log_path_err: string | null
}

export type ActionType = 'submit' | 'status' | 'get_result' | 'list' | 'cancel' | 'cleanup'

export interface SubmitAction {
  action: 'submit'
  command: string
  workdir?: string
  timeout_ms?: number
  priority?: number
}

export interface StatusAction {
  action: 'status'
  task_id: string
}

export interface GetResultAction {
  action: 'get_result'
  task_id: string
  tail?: number // Number of lines from the end (default: all)
}

export interface ListAction {
  action: 'list'
  status?: TaskStatus // Filter by status
  limit?: number // Max number of tasks to return
}

export interface CancelAction {
  action: 'cancel'
  task_id: string
}

export interface CleanupAction {
  action: 'cleanup'
  older_than_hours?: number // Delete tasks older than this (default: 24)
}

export type BgShAction =
  | SubmitAction
  | StatusAction
  | GetResultAction
  | ListAction
  | CancelAction
  | CleanupAction

export interface SubmitResult {
  task_id: string
  status: TaskStatus
  message: string
}

export interface StatusResult {
  task: Task
}

export interface GetResultResult {
  task: Task
  stdout: string
  stderr: string
}

export interface ListResult {
  tasks: Task[]
  total: number
}

export interface CancelResult {
  task_id: string
  previous_status: TaskStatus
  message: string
}

export interface CleanupResult {
  deleted_count: number
  message: string
}

export interface ActiveWorker {
  task_id: string
  proc: ReturnType<typeof Bun.spawn>
  started_at: number
}
