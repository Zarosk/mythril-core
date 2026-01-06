import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import type { Note, CreateNoteInput, NoteListQuery, PaginatedResponse } from '../types/index.js';
import { sanitizeContent, sanitizeProjectName, sanitizeTags } from '../security/sanitize.js';
import { syncNoteToVault, deleteNoteFromVault } from './vault-sync.js';
import logger from '../utils/logger.js';

/**
 * Create a new note
 */
export function createNote(input: CreateNoteInput): Note {
  const db = getDb();
  const id = `note_${nanoid(12)}`;
  const now = new Date().toISOString();

  const content = sanitizeContent(input.content);
  const project = input.project ? sanitizeProjectName(input.project) : null;
  const tags = input.tags ? JSON.stringify(sanitizeTags(input.tags)) : null;
  const source = input.source ?? 'api';

  db.prepare(`
    INSERT INTO notes (id, content, project, tags, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, content, project, tags, source, now);

  const note = getNoteById(id);
  if (!note) {
    throw new Error('Failed to create note');
  }

  // Sync to vault asynchronously
  try {
    syncNoteToVault(note);
  } catch (error) {
    logger.warn('Failed to sync note to vault', { noteId: id, error });
  }

  return note;
}

/**
 * Get a note by ID
 */
export function getNoteById(id: string): Note | null {
  const db = getDb();
  const result = db.prepare(`
    SELECT * FROM notes WHERE id = ?
  `).get(id) as Note | undefined;

  return result ?? null;
}

/**
 * List notes with optional filtering and pagination
 */
export function listNotes(query: NoteListQuery): PaginatedResponse<Note> {
  const db = getDb();
  const { project, limit = 20, offset = 0, search } = query;

  let sql = 'SELECT * FROM notes WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM notes WHERE 1=1';
  const params: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (project) {
    sql += ' AND project = ?';
    countSql += ' AND project = ?';
    params.push(project);
    countParams.push(project);
  }

  if (search) {
    sql += ' AND content LIKE ?';
    countSql += ' AND content LIKE ?';
    const searchPattern = `%${search}%`;
    params.push(searchPattern);
    countParams.push(searchPattern);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const notes = db.prepare(sql).all(...params) as Note[];
  const totalResult = db.prepare(countSql).get(...countParams) as { total: number };

  return {
    data: notes,
    total: totalResult.total,
    limit,
    offset
  };
}

/**
 * Update a note
 */
export function updateNote(id: string, updates: Partial<CreateNoteInput>): Note | null {
  const db = getDb();
  const existing = getNoteById(id);

  if (!existing) {
    return null;
  }

  const content = updates.content !== undefined ? sanitizeContent(updates.content) : existing.content;
  const project = updates.project !== undefined
    ? (updates.project ? sanitizeProjectName(updates.project) : null)
    : existing.project;
  const tags = updates.tags !== undefined
    ? JSON.stringify(sanitizeTags(updates.tags))
    : existing.tags;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE notes
    SET content = ?, project = ?, tags = ?, updated_at = ?
    WHERE id = ?
  `).run(content, project, tags, now, id);

  const updated = getNoteById(id);
  if (updated) {
    try {
      syncNoteToVault(updated);
    } catch (error) {
      logger.warn('Failed to sync note to vault', { noteId: id, error });
    }
  }

  return updated;
}

/**
 * Delete a note
 */
export function deleteNote(id: string): boolean {
  const db = getDb();
  const note = getNoteById(id);

  if (!note) {
    return false;
  }

  const result = db.prepare(`
    DELETE FROM notes WHERE id = ?
  `).run(id);

  if (result.changes > 0) {
    try {
      deleteNoteFromVault(note);
    } catch (error) {
      logger.warn('Failed to delete note from vault', { noteId: id, error });
    }
  }

  return result.changes > 0;
}

/**
 * Get notes by project
 */
export function getNotesByProject(project: string, limit: number = 10): Note[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM notes
    WHERE project = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(project, limit) as Note[];
}

/**
 * Get recent notes
 */
export function getRecentNotes(limit: number = 10): Note[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM notes
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Note[];
}
