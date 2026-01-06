import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import type { Note, Artifact, Task } from '../types/index.js';

/**
 * Get the base vault path for brain content
 */
function getBrainVaultPath(): string | null {
  if (!config.obsidianVaultPath) {
    return null;
  }
  return path.join(config.obsidianVaultPath, 'brain');
}

/**
 * Ensure a directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Sync a note to the Obsidian vault
 */
export function syncNoteToVault(note: Note): void {
  const basePath = getBrainVaultPath();
  if (!basePath) {
    return;
  }

  const dir = path.join(basePath, 'notes');
  ensureDir(dir);

  const filename = `${note.id}.md`;
  const tags = note.tags ? JSON.parse(note.tags) : [];

  const content = `---
id: ${note.id}
project: ${note.project ?? 'none'}
tags: ${JSON.stringify(tags)}
source: ${note.source}
created: ${note.created_at}
updated: ${note.updated_at ?? note.created_at}
---

${note.content}
`;

  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

/**
 * Delete a note from the vault
 */
export function deleteNoteFromVault(note: Note): void {
  const basePath = getBrainVaultPath();
  if (!basePath) {
    return;
  }

  const filepath = path.join(basePath, 'notes', `${note.id}.md`);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

/**
 * Sync an artifact to the Obsidian vault
 */
export function syncArtifactToVault(artifact: Artifact): void {
  const basePath = getBrainVaultPath();
  if (!basePath) {
    return;
  }

  const dir = path.join(basePath, 'artifacts');
  ensureDir(dir);

  const filename = `${artifact.id}.md`;

  // Determine code block language
  let codeLanguage = '';
  if (artifact.content_type === 'code' && artifact.language) {
    codeLanguage = artifact.language;
  } else if (artifact.content_type === 'json') {
    codeLanguage = 'json';
  }

  const contentBlock = artifact.content_type === 'markdown'
    ? artifact.content
    : `\`\`\`${codeLanguage}\n${artifact.content}\n\`\`\``;

  const content = `---
id: ${artifact.id}
title: "${artifact.title.replace(/"/g, '\\"')}"
content_type: ${artifact.content_type}
language: ${artifact.language ?? 'none'}
project: ${artifact.project ?? 'none'}
source: ${artifact.source}
created: ${artifact.created_at}
updated: ${artifact.updated_at ?? artifact.created_at}
---

# ${artifact.title}

${contentBlock}
`;

  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

/**
 * Delete an artifact from the vault
 */
export function deleteArtifactFromVault(artifact: Artifact): void {
  const basePath = getBrainVaultPath();
  if (!basePath) {
    return;
  }

  const filepath = path.join(basePath, 'artifacts', `${artifact.id}.md`);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

/**
 * Sync a task to the Obsidian vault
 */
export function syncTaskToVault(task: Task): void {
  const basePath = getBrainVaultPath();
  if (!basePath) {
    return;
  }

  const dir = path.join(basePath, 'tasks');
  ensureDir(dir);

  const filename = `${task.id}.md`;

  // Determine checkbox status
  let checkbox = '[ ]';
  if (task.status === 'active') {
    checkbox = '[/]'; // In progress
  } else if (task.status === 'completed') {
    checkbox = '[x]';
  } else if (task.status === 'cancelled') {
    checkbox = '[-]';
  }

  const content = `---
id: ${task.id}
project: ${task.project}
status: ${task.status}
trust_level: ${task.trust_level}
priority: ${task.priority}
created: ${task.created_at}
started: ${task.started_at ?? 'null'}
completed: ${task.completed_at ?? 'null'}
---

# ${checkbox} ${task.title}

**Project:** [[${task.project}]]
**Status:** ${task.status}
**Priority:** ${task.priority}
**Trust Level:** ${task.trust_level}

${task.description ?? ''}
`;

  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

/**
 * Delete a task from the vault
 */
export function deleteTaskFromVault(task: Task): void {
  const basePath = getBrainVaultPath();
  if (!basePath) {
    return;
  }

  const filepath = path.join(basePath, 'tasks', `${task.id}.md`);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

/**
 * Check if vault sync is enabled
 */
export function isVaultSyncEnabled(): boolean {
  return !!config.obsidianVaultPath && fs.existsSync(config.obsidianVaultPath);
}

/**
 * Get vault sync status
 */
export function getVaultSyncStatus(): {
  enabled: boolean;
  path: string | null;
  directories: {
    notes: boolean;
    artifacts: boolean;
    tasks: boolean;
  };
} {
  const basePath = getBrainVaultPath();

  if (!basePath || !config.obsidianVaultPath) {
    return {
      enabled: false,
      path: null,
      directories: { notes: false, artifacts: false, tasks: false }
    };
  }

  return {
    enabled: true,
    path: basePath,
    directories: {
      notes: fs.existsSync(path.join(basePath, 'notes')),
      artifacts: fs.existsSync(path.join(basePath, 'artifacts')),
      tasks: fs.existsSync(path.join(basePath, 'tasks'))
    }
  };
}
