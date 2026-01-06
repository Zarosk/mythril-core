import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import type { ProjectContext, UpdateContextInput } from '../types/index.js';
import { sanitizeProjectName, sanitizeContent, truncate } from '../security/sanitize.js';
import { getNotesByProject } from './notes.js';
import { getArtifactsByProject } from './artifacts.js';

interface FullProjectContext extends ProjectContext {
  recent_notes: Array<{ id: string; content: string; created_at: string }>;
  recent_artifacts: Array<{ id: string; title: string; content_type: string; created_at: string }>;
}

/**
 * Get or create project context
 */
export function getContext(project: string): FullProjectContext | null {
  const db = getDb();
  const sanitizedProject = sanitizeProjectName(project);

  if (!sanitizedProject) {
    return null;
  }

  let context = db.prepare(`
    SELECT * FROM context WHERE project = ?
  `).get(sanitizedProject) as ProjectContext | undefined;

  // Get recent notes and artifacts for this project
  const recentNotes = getNotesByProject(sanitizedProject, 5).map(n => ({
    id: n.id,
    content: n.content.slice(0, 200),
    created_at: n.created_at
  }));

  const recentArtifacts = getArtifactsByProject(sanitizedProject, 5).map(a => ({
    id: a.id,
    title: a.title,
    content_type: a.content_type,
    created_at: a.created_at
  }));

  if (!context) {
    // Return empty context with related items
    return {
      id: '',
      project: sanitizedProject,
      summary: null,
      tech_stack: null,
      conventions: null,
      updated_at: new Date().toISOString(),
      recent_notes: recentNotes,
      recent_artifacts: recentArtifacts
    };
  }

  return {
    ...context,
    recent_notes: recentNotes,
    recent_artifacts: recentArtifacts
  };
}

/**
 * Update or create project context
 */
export function updateContext(project: string, updates: UpdateContextInput): ProjectContext | null {
  const db = getDb();
  const sanitizedProject = sanitizeProjectName(project);

  if (!sanitizedProject) {
    return null;
  }

  const existing = db.prepare(`
    SELECT * FROM context WHERE project = ?
  `).get(sanitizedProject) as ProjectContext | undefined;

  const now = new Date().toISOString();

  const summary = updates.summary !== undefined
    ? sanitizeContent(updates.summary, 10000)
    : (existing?.summary ?? null);

  const techStack = updates.tech_stack !== undefined
    ? JSON.stringify(updates.tech_stack.map(t => truncate(t, 100)).slice(0, 50))
    : (existing?.tech_stack ?? null);

  const conventions = updates.conventions !== undefined
    ? sanitizeContent(updates.conventions, 10000)
    : (existing?.conventions ?? null);

  if (existing) {
    db.prepare(`
      UPDATE context
      SET summary = ?, tech_stack = ?, conventions = ?, updated_at = ?
      WHERE project = ?
    `).run(summary, techStack, conventions, now, sanitizedProject);
  } else {
    const id = `ctx_${nanoid(12)}`;
    db.prepare(`
      INSERT INTO context (id, project, summary, tech_stack, conventions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sanitizedProject, summary, techStack, conventions, now);
  }

  return db.prepare(`
    SELECT * FROM context WHERE project = ?
  `).get(sanitizedProject) as ProjectContext;
}

/**
 * Delete project context
 */
export function deleteContext(project: string): boolean {
  const db = getDb();
  const sanitizedProject = sanitizeProjectName(project);

  if (!sanitizedProject) {
    return false;
  }

  const result = db.prepare(`
    DELETE FROM context WHERE project = ?
  `).run(sanitizedProject);

  return result.changes > 0;
}

/**
 * List all project contexts
 */
export function listContexts(): ProjectContext[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM context ORDER BY updated_at DESC
  `).all() as ProjectContext[];
}

/**
 * Get all unique projects across notes, artifacts, and tasks
 */
export function getAllProjects(): string[] {
  const db = getDb();

  const noteProjects = db.prepare(`
    SELECT DISTINCT project FROM notes WHERE project IS NOT NULL
  `).all() as { project: string }[];

  const artifactProjects = db.prepare(`
    SELECT DISTINCT project FROM artifacts WHERE project IS NOT NULL
  `).all() as { project: string }[];

  const taskProjects = db.prepare(`
    SELECT DISTINCT project FROM tasks WHERE project IS NOT NULL
  `).all() as { project: string }[];

  const contextProjects = db.prepare(`
    SELECT DISTINCT project FROM context
  `).all() as { project: string }[];

  const allProjects = new Set([
    ...noteProjects.map(p => p.project),
    ...artifactProjects.map(p => p.project),
    ...taskProjects.map(p => p.project),
    ...contextProjects.map(p => p.project)
  ]);

  return Array.from(allProjects).sort();
}
