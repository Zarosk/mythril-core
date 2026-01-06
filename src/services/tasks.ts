import { getDb } from '../db/client.js';
import type { Task, CreateTaskInput, TaskStatus, PaginatedResponse } from '../types/index.js';
import { sanitizeProjectName, sanitizeContent, truncate } from '../security/sanitize.js';
import { syncTaskToVault, deleteTaskFromVault } from './vault-sync.js';
import logger from '../utils/logger.js';

interface TaskListQuery {
  project?: string;
  status?: TaskStatus;
  limit?: number;
  offset?: number;
}

/**
 * Generate a task ID in format PROJECT-NNN
 */
function generateTaskId(project: string): string {
  const db = getDb();
  const prefix = project.toUpperCase().slice(0, 10);

  // Get the highest existing task number for this project
  const result = db.prepare(`
    SELECT id FROM tasks
    WHERE id LIKE ? || '-%'
    ORDER BY CAST(SUBSTR(id, LENGTH(?) + 2) AS INTEGER) DESC
    LIMIT 1
  `).get(prefix, prefix) as { id: string } | undefined;

  let nextNum = 1;
  if (result) {
    const match = result.id.match(/-(\d+)$/);
    if (match?.[1]) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Create a new task
 */
export function createTask(input: CreateTaskInput): Task {
  const db = getDb();
  const project = sanitizeProjectName(input.project);

  if (!project) {
    throw new Error('Project is required');
  }

  const id = generateTaskId(project);
  const now = new Date().toISOString();

  const title = truncate(input.title, 200);
  const description = input.description ? sanitizeContent(input.description, 10000) : null;
  const trustLevel = input.trust_level ?? 'PROTOTYPE';
  const priority = input.priority ?? 'NORMAL';

  db.prepare(`
    INSERT INTO tasks (id, title, description, project, status, trust_level, priority, created_at)
    VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)
  `).run(id, title, description, project, trustLevel, priority, now);

  const task = getTaskById(id);
  if (!task) {
    throw new Error('Failed to create task');
  }

  // Sync to vault
  try {
    syncTaskToVault(task);
  } catch (error) {
    logger.warn('Failed to sync task to vault', { taskId: id, error });
  }

  return task;
}

/**
 * Get a task by ID
 */
export function getTaskById(id: string): Task | null {
  const db = getDb();
  const result = db.prepare(`
    SELECT * FROM tasks WHERE id = ?
  `).get(id) as Task | undefined;

  return result ?? null;
}

/**
 * List tasks with optional filtering and pagination
 */
export function listTasks(query: TaskListQuery): PaginatedResponse<Task> {
  const db = getDb();
  const { project, status, limit = 20, offset = 0 } = query;

  let sql = 'SELECT * FROM tasks WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM tasks WHERE 1=1';
  const params: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (project) {
    sql += ' AND project = ?';
    countSql += ' AND project = ?';
    params.push(project);
    countParams.push(project);
  }

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const tasks = db.prepare(sql).all(...params) as Task[];
  const totalResult = db.prepare(countSql).get(...countParams) as { total: number };

  return {
    data: tasks,
    total: totalResult.total,
    limit,
    offset
  };
}

/**
 * Activate a task (set status to 'active')
 */
export function activateTask(id: string): Task | null {
  const db = getDb();
  const task = getTaskById(id);

  if (!task) {
    return null;
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error(`Cannot activate task with status: ${task.status}`);
  }

  // Deactivate any currently active tasks in the same project
  db.prepare(`
    UPDATE tasks
    SET status = 'queued'
    WHERE project = ? AND status = 'active'
  `).run(task.project);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks
    SET status = 'active', started_at = COALESCE(started_at, ?)
    WHERE id = ?
  `).run(now, id);

  const updated = getTaskById(id);
  if (updated) {
    try {
      syncTaskToVault(updated);
    } catch (error) {
      logger.warn('Failed to sync task to vault', { taskId: id, error });
    }
  }

  return updated;
}

/**
 * Complete a task
 */
export function completeTask(id: string): Task | null {
  const db = getDb();
  const task = getTaskById(id);

  if (!task) {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks
    SET status = 'completed', completed_at = ?
    WHERE id = ?
  `).run(now, id);

  const updated = getTaskById(id);
  if (updated) {
    try {
      syncTaskToVault(updated);
    } catch (error) {
      logger.warn('Failed to sync task to vault', { taskId: id, error });
    }
  }

  return updated;
}

/**
 * Cancel a task
 */
export function cancelTask(id: string): Task | null {
  const db = getDb();
  const task = getTaskById(id);

  if (!task) {
    return null;
  }

  db.prepare(`
    UPDATE tasks
    SET status = 'cancelled'
    WHERE id = ?
  `).run(id);

  const updated = getTaskById(id);
  if (updated) {
    try {
      syncTaskToVault(updated);
    } catch (error) {
      logger.warn('Failed to sync task to vault', { taskId: id, error });
    }
  }

  return updated;
}

/**
 * Delete a task
 */
export function deleteTask(id: string): boolean {
  const db = getDb();
  const task = getTaskById(id);

  if (!task) {
    return false;
  }

  const result = db.prepare(`
    DELETE FROM tasks WHERE id = ?
  `).run(id);

  if (result.changes > 0) {
    try {
      deleteTaskFromVault(task);
    } catch (error) {
      logger.warn('Failed to delete task from vault', { taskId: id, error });
    }
  }

  return result.changes > 0;
}

/**
 * Get the currently active task for a project
 */
export function getActiveTask(project: string): Task | null {
  const db = getDb();
  const sanitizedProject = sanitizeProjectName(project);

  const result = db.prepare(`
    SELECT * FROM tasks
    WHERE project = ? AND status = 'active'
    LIMIT 1
  `).get(sanitizedProject) as Task | undefined;

  return result ?? null;
}

/**
 * Get queued tasks for a project
 */
export function getQueuedTasks(project: string, limit: number = 10): Task[] {
  const db = getDb();
  const sanitizedProject = sanitizeProjectName(project);

  return db.prepare(`
    SELECT * FROM tasks
    WHERE project = ? AND status = 'queued'
    ORDER BY
      CASE priority
        WHEN 'CRITICAL' THEN 0
        WHEN 'HIGH' THEN 1
        WHEN 'NORMAL' THEN 2
        WHEN 'LOW' THEN 3
      END,
      created_at ASC
    LIMIT ?
  `).all(sanitizedProject, limit) as Task[];
}
