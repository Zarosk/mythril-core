import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import type { Artifact, CreateArtifactInput, UpdateArtifactInput, PaginatedResponse } from '../types/index.js';
import { sanitizeContent, sanitizeProjectName, truncate } from '../security/sanitize.js';
import { syncArtifactToVault, deleteArtifactFromVault } from './vault-sync.js';
import logger from '../utils/logger.js';

interface ArtifactListQuery {
  project?: string;
  content_type?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Create a new artifact
 */
export function createArtifact(input: CreateArtifactInput): Artifact {
  const db = getDb();
  const id = `artifact_${nanoid(12)}`;
  const now = new Date().toISOString();

  const title = truncate(input.title, 200);
  const content = sanitizeContent(input.content, 500000); // Allow larger content for code
  const contentType = input.content_type;
  const language = input.language ? truncate(input.language, 50) : null;
  const project = input.project ? sanitizeProjectName(input.project) : null;
  const source = input.source ?? 'api';

  db.prepare(`
    INSERT INTO artifacts (id, title, content, content_type, language, project, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, content, contentType, language, project, source, now);

  const artifact = getArtifactById(id);
  if (!artifact) {
    throw new Error('Failed to create artifact');
  }

  // Sync to vault
  try {
    syncArtifactToVault(artifact);
  } catch (error) {
    logger.warn('Failed to sync artifact to vault', { artifactId: id, error });
  }

  return artifact;
}

/**
 * Get an artifact by ID
 */
export function getArtifactById(id: string): Artifact | null {
  const db = getDb();
  const result = db.prepare(`
    SELECT * FROM artifacts WHERE id = ?
  `).get(id) as Artifact | undefined;

  return result ?? null;
}

/**
 * List artifacts with optional filtering and pagination
 */
export function listArtifacts(query: ArtifactListQuery): PaginatedResponse<Artifact> {
  const db = getDb();
  const { project, content_type, limit = 20, offset = 0, search } = query;

  let sql = 'SELECT * FROM artifacts WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM artifacts WHERE 1=1';
  const params: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (project) {
    sql += ' AND project = ?';
    countSql += ' AND project = ?';
    params.push(project);
    countParams.push(project);
  }

  if (content_type) {
    sql += ' AND content_type = ?';
    countSql += ' AND content_type = ?';
    params.push(content_type);
    countParams.push(content_type);
  }

  if (search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    countSql += ' AND (title LIKE ? OR content LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
    countParams.push(searchPattern, searchPattern);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const artifacts = db.prepare(sql).all(...params) as Artifact[];
  const totalResult = db.prepare(countSql).get(...countParams) as { total: number };

  return {
    data: artifacts,
    total: totalResult.total,
    limit,
    offset
  };
}

/**
 * Update an artifact
 */
export function updateArtifact(id: string, updates: UpdateArtifactInput): Artifact | null {
  const db = getDb();
  const existing = getArtifactById(id);

  if (!existing) {
    return null;
  }

  const title = updates.title !== undefined ? truncate(updates.title, 200) : existing.title;
  const content = updates.content !== undefined ? sanitizeContent(updates.content, 500000) : existing.content;
  const contentType = updates.content_type ?? existing.content_type;
  const language = updates.language !== undefined
    ? (updates.language ? truncate(updates.language, 50) : null)
    : existing.language;
  const project = updates.project !== undefined
    ? (updates.project ? sanitizeProjectName(updates.project) : null)
    : existing.project;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE artifacts
    SET title = ?, content = ?, content_type = ?, language = ?, project = ?, updated_at = ?
    WHERE id = ?
  `).run(title, content, contentType, language, project, now, id);

  const updated = getArtifactById(id);
  if (updated) {
    try {
      syncArtifactToVault(updated);
    } catch (error) {
      logger.warn('Failed to sync artifact to vault', { artifactId: id, error });
    }
  }

  return updated;
}

/**
 * Delete an artifact
 */
export function deleteArtifact(id: string): boolean {
  const db = getDb();
  const artifact = getArtifactById(id);

  if (!artifact) {
    return false;
  }

  const result = db.prepare(`
    DELETE FROM artifacts WHERE id = ?
  `).run(id);

  if (result.changes > 0) {
    try {
      deleteArtifactFromVault(artifact);
    } catch (error) {
      logger.warn('Failed to delete artifact from vault', { artifactId: id, error });
    }
  }

  return result.changes > 0;
}

/**
 * Get artifacts by project
 */
export function getArtifactsByProject(project: string, limit: number = 10): Artifact[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM artifacts
    WHERE project = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(project, limit) as Artifact[];
}

/**
 * Get recent artifacts
 */
export function getRecentArtifacts(limit: number = 10): Artifact[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM artifacts
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Artifact[];
}
