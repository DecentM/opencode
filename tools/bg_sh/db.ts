import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import type { Task, TaskRow, TaskStatus } from './types'

let db: Database | null = null

const getDbPath = (): string => {
  return join(process.cwd(), '.bg_sh.db')
}

export const initDatabase = (): Database => {
  if (db) return db

  db = new Database(getDbPath())

  // Enable WAL mode for better concurrent access
  db.exec('PRAGMA journal_mode = WAL')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      workdir TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      exit_code INTEGER,
      timeout_ms INTEGER DEFAULT 30000,
      priority INTEGER DEFAULT 0,
      log_path_out TEXT,
      log_path_err TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_created ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_priority_created ON tasks(priority DESC, created_at ASC);
  `)

  return db
}

export const getDb = (): Database => {
  return initDatabase()
}

export const closeDatabase = (): void => {
  if (db) {
    db.close()
    db = null
  }
}

const rowToTask = (row: TaskRow): Task => {
  return {
    id: row.id,
    command: row.command,
    workdir: row.workdir,
    status: row.status as TaskStatus,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    exit_code: row.exit_code,
    timeout_ms: row.timeout_ms,
    priority: row.priority,
    log_path_out: row.log_path_out,
    log_path_err: row.log_path_err,
  }
}

export const createTask = (task: Task): void => {
  const database = getDb()
  const stmt = database.prepare(`
    INSERT INTO tasks (
      id, command, workdir, status, created_at, started_at, finished_at,
      exit_code, timeout_ms, priority, log_path_out, log_path_err
    ) VALUES (
      $id, $command, $workdir, $status, $created_at, $started_at, $finished_at,
      $exit_code, $timeout_ms, $priority, $log_path_out, $log_path_err
    )
  `)

  stmt.run({
    $id: task.id,
    $command: task.command,
    $workdir: task.workdir,
    $status: task.status,
    $created_at: task.created_at,
    $started_at: task.started_at,
    $finished_at: task.finished_at,
    $exit_code: task.exit_code,
    $timeout_ms: task.timeout_ms,
    $priority: task.priority,
    $log_path_out: task.log_path_out,
    $log_path_err: task.log_path_err,
  })
}

export const getTask = (id: string): Task | null => {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM tasks WHERE id = $id')
  const row = stmt.get({ $id: id }) as TaskRow | null

  return row ? rowToTask(row) : null
}

export const updateTaskStatus = (
  id: string,
  status: TaskStatus,
  updates?: {
    started_at?: number
    finished_at?: number
    exit_code?: number
    log_path_out?: string
    log_path_err?: string
  }
): void => {
  const database = getDb()

  // Build dynamic update query
  const setClause = ['status = $status']
  const params: Record<string, string | number | null> = { $id: id, $status: status }

  if (updates?.started_at !== undefined) {
    setClause.push('started_at = $started_at')
    params.$started_at = updates.started_at
  }
  if (updates?.finished_at !== undefined) {
    setClause.push('finished_at = $finished_at')
    params.$finished_at = updates.finished_at
  }
  if (updates?.exit_code !== undefined) {
    setClause.push('exit_code = $exit_code')
    params.$exit_code = updates.exit_code
  }
  if (updates?.log_path_out !== undefined) {
    setClause.push('log_path_out = $log_path_out')
    params.$log_path_out = updates.log_path_out
  }
  if (updates?.log_path_err !== undefined) {
    setClause.push('log_path_err = $log_path_err')
    params.$log_path_err = updates.log_path_err
  }

  const stmt = database.prepare(`UPDATE tasks SET ${setClause.join(', ')} WHERE id = $id`)
  stmt.run(params)
}

export const listTasks = (options?: { status?: TaskStatus; limit?: number }): Task[] => {
  const database = getDb()

  let query = 'SELECT * FROM tasks'
  const params: Record<string, string | number | null> = {}

  if (options?.status) {
    query += ' WHERE status = $status'
    params.$status = options.status
  }

  query += ' ORDER BY priority DESC, created_at DESC'

  if (options?.limit) {
    query += ' LIMIT $limit'
    params.$limit = options.limit
  }

  const stmt = database.prepare(query)
  const rows = stmt.all(params) as TaskRow[]

  return rows.map(rowToTask)
}

export const getNextPendingTask = (): Task | null => {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT * FROM tasks
    WHERE status = 'PENDING'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
  `)
  const row = stmt.get() as TaskRow | null

  return row ? rowToTask(row) : null
}

export const countTasksByStatus = (status: TaskStatus): number => {
  const database = getDb()
  const stmt = database.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = $status')
  const result = stmt.get({ $status: status }) as { count: number }
  return result.count
}

export const deleteOldTasks = (olderThanMs: number): number => {
  const database = getDb()
  const cutoff = Date.now() - olderThanMs
  const stmt = database.prepare(`
    DELETE FROM tasks
    WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED', 'CRASHED')
    AND created_at < $cutoff
  `)
  const result = stmt.run({ $cutoff: cutoff })
  return result.changes
}

export const markRunningAsCrashed = (): number => {
  const database = getDb()
  const stmt = database.prepare(`
    UPDATE tasks
    SET status = 'CRASHED', finished_at = $now
    WHERE status = 'RUNNING'
  `)
  const result = stmt.run({ $now: Date.now() })
  return result.changes
}

export const resetQueuedToPending = (): number => {
  const database = getDb()
  const stmt = database.prepare(`
    UPDATE tasks
    SET status = 'PENDING'
    WHERE status = 'QUEUED'
  `)
  const result = stmt.run()
  return result.changes
}
