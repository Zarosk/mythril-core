import type { FastifyRequest } from 'fastify';
import { getDb } from '../db/client.js';
import type { AuditLogEntry } from '../types/index.js';

export type AuditAction =
  | 'auth.missing_key'
  | 'auth.invalid_key'
  | 'auth.revoked_key'
  | 'auth.success'
  | 'note.create'
  | 'note.read'
  | 'note.list'
  | 'note.delete'
  | 'artifact.create'
  | 'artifact.read'
  | 'artifact.list'
  | 'artifact.update'
  | 'artifact.delete'
  | 'context.read'
  | 'context.update'
  | 'task.create'
  | 'task.read'
  | 'task.list'
  | 'task.activate'
  | 'task.delete'
  | 'search.query'
  | 'rate_limit.exceeded';

/**
 * Log an audit event
 */
export function audit(
  action: AuditAction,
  request: FastifyRequest,
  resourceType?: string,
  resourceId?: string,
  statusCode: number = 200
): void {
  const db = getDb();

  try {
    db.prepare(`
      INSERT INTO audit_log (api_key_id, action, resource_type, resource_id, ip_address, status_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      request.apiKey?.id ?? null,
      action,
      resourceType ?? null,
      resourceId ?? null,
      request.ip,
      statusCode
    );
  } catch (error) {
    // Log but don't throw - audit failures shouldn't break the request
    console.error('Audit log error:', error);
  }
}

/**
 * Get recent audit log entries
 */
export function getAuditLog(limit: number = 100, offset: number = 0): AuditLogEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM audit_log
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as AuditLogEntry[];
}

/**
 * Get audit log entries for a specific API key
 */
export function getAuditLogByKey(keyId: string, limit: number = 100): AuditLogEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM audit_log
    WHERE api_key_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(keyId, limit) as AuditLogEntry[];
}

/**
 * Get audit log entries for a specific resource
 */
export function getAuditLogByResource(
  resourceType: string,
  resourceId: string,
  limit: number = 50
): AuditLogEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM audit_log
    WHERE resource_type = ? AND resource_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(resourceType, resourceId, limit) as AuditLogEntry[];
}

/**
 * Clean up old audit log entries (older than specified days)
 */
export function cleanupAuditLog(olderThanDays: number = 90): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM audit_log
    WHERE timestamp < datetime('now', ? || ' days')
  `).run(`-${olderThanDays}`);

  return result.changes;
}
