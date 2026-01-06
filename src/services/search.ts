import { getDb } from '../db/client.js';
import type { SearchResult, SearchQuery } from '../types/index.js';
import { truncate } from '../security/sanitize.js';

/**
 * Search across notes, artifacts, and tasks
 */
export function search(query: SearchQuery): SearchResult[] {
  const db = getDb();
  const { q, types, project, limit = 20 } = query;

  if (!q || q.trim().length === 0) {
    return [];
  }

  const searchTerm = `%${q}%`;
  const results: SearchResult[] = [];

  const shouldSearchNotes = !types || types.includes('notes');
  const shouldSearchArtifacts = !types || types.includes('artifacts');
  const shouldSearchTasks = !types || types.includes('tasks');

  // Search notes
  if (shouldSearchNotes) {
    let noteSql = `
      SELECT id, content, project
      FROM notes
      WHERE content LIKE ?
    `;
    const noteParams: (string | number)[] = [searchTerm];

    if (project) {
      noteSql += ' AND project = ?';
      noteParams.push(project);
    }

    noteSql += ' LIMIT ?';
    noteParams.push(limit);

    const notes = db.prepare(noteSql).all(...noteParams) as Array<{
      id: string;
      content: string;
      project: string | null;
    }>;

    for (const note of notes) {
      results.push({
        type: 'note',
        id: note.id,
        snippet: createSnippet(note.content, q),
        score: calculateScore(note.content, q),
        project: note.project
      });
    }
  }

  // Search artifacts
  if (shouldSearchArtifacts) {
    let artifactSql = `
      SELECT id, title, content, project
      FROM artifacts
      WHERE title LIKE ? OR content LIKE ?
    `;
    const artifactParams: (string | number)[] = [searchTerm, searchTerm];

    if (project) {
      artifactSql += ' AND project = ?';
      artifactParams.push(project);
    }

    artifactSql += ' LIMIT ?';
    artifactParams.push(limit);

    const artifacts = db.prepare(artifactSql).all(...artifactParams) as Array<{
      id: string;
      title: string;
      content: string;
      project: string | null;
    }>;

    for (const artifact of artifacts) {
      const matchText = artifact.title.toLowerCase().includes(q.toLowerCase())
        ? artifact.title
        : artifact.content;

      results.push({
        type: 'artifact',
        id: artifact.id,
        snippet: createSnippet(matchText, q),
        score: calculateScore(artifact.title + ' ' + artifact.content, q),
        project: artifact.project
      });
    }
  }

  // Search tasks
  if (shouldSearchTasks) {
    let taskSql = `
      SELECT id, title, description, project
      FROM tasks
      WHERE title LIKE ? OR description LIKE ?
    `;
    const taskParams: (string | number)[] = [searchTerm, searchTerm];

    if (project) {
      taskSql += ' AND project = ?';
      taskParams.push(project);
    }

    taskSql += ' LIMIT ?';
    taskParams.push(limit);

    const tasks = db.prepare(taskSql).all(...taskParams) as Array<{
      id: string;
      title: string;
      description: string | null;
      project: string;
    }>;

    for (const task of tasks) {
      const matchText = task.title.toLowerCase().includes(q.toLowerCase())
        ? task.title
        : (task.description ?? task.title);

      results.push({
        type: 'task',
        id: task.id,
        snippet: createSnippet(matchText, q),
        score: calculateScore(task.title + ' ' + (task.description ?? ''), q),
        project: task.project
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Apply final limit
  return results.slice(0, limit);
}

/**
 * Create a snippet around the search term
 */
function createSnippet(text: string, searchTerm: string, maxLength: number = 150): string {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();

  const index = lowerText.indexOf(lowerSearch);

  if (index === -1) {
    return truncate(text, maxLength);
  }

  // Calculate start position to center the match
  const snippetRadius = Math.floor((maxLength - searchTerm.length) / 2);
  let start = Math.max(0, index - snippetRadius);
  let end = Math.min(text.length, index + searchTerm.length + snippetRadius);

  // Adjust to word boundaries if possible
  if (start > 0) {
    const spaceIndex = text.indexOf(' ', start);
    if (spaceIndex !== -1 && spaceIndex < index) {
      start = spaceIndex + 1;
    }
  }

  if (end < text.length) {
    const spaceIndex = text.lastIndexOf(' ', end);
    if (spaceIndex > index + searchTerm.length) {
      end = spaceIndex;
    }
  }

  let snippet = text.slice(start, end);

  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < text.length) {
    snippet = snippet + '...';
  }

  return snippet;
}

/**
 * Calculate a basic relevance score
 */
function calculateScore(text: string, searchTerm: string): number {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();

  // Count occurrences
  let count = 0;
  let pos = 0;
  while ((pos = lowerText.indexOf(lowerSearch, pos)) !== -1) {
    count++;
    pos += lowerSearch.length;
  }

  // Base score from occurrence count
  let score = Math.min(count * 0.2, 1.0);

  // Boost if search term appears at the start
  if (lowerText.startsWith(lowerSearch)) {
    score += 0.3;
  }

  // Boost for exact word match
  const wordPattern = new RegExp(`\\b${escapeRegex(lowerSearch)}\\b`, 'i');
  if (wordPattern.test(text)) {
    score += 0.2;
  }

  // Normalize score to 0-1 range
  return Math.min(score, 1.0);
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get search suggestions based on common terms
 */
export function getSuggestions(partialQuery: string, limit: number = 5): string[] {
  const db = getDb();

  if (!partialQuery || partialQuery.length < 2) {
    return [];
  }

  const searchTerm = `${partialQuery}%`;

  // Get unique terms from note content, artifact titles, and task titles
  const suggestions = new Set<string>();

  // From note tags
  const notes = db.prepare(`
    SELECT DISTINCT tags FROM notes
    WHERE tags LIKE ?
    LIMIT ?
  `).all(searchTerm, limit) as { tags: string }[];

  for (const note of notes) {
    if (note.tags) {
      try {
        const tags = JSON.parse(note.tags) as string[];
        for (const tag of tags) {
          if (tag.toLowerCase().startsWith(partialQuery.toLowerCase())) {
            suggestions.add(tag);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // From artifact titles
  const artifacts = db.prepare(`
    SELECT DISTINCT title FROM artifacts
    WHERE title LIKE ?
    LIMIT ?
  `).all(searchTerm, limit) as { title: string }[];

  for (const artifact of artifacts) {
    suggestions.add(artifact.title);
  }

  return Array.from(suggestions).slice(0, limit);
}
