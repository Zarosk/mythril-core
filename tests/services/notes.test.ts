import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, getDb } from '../../src/db/client.js';
import * as notesService from '../../src/services/notes.js';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_PATH'] = ':memory:';
process.env['OBSIDIAN_VAULT_PATH'] = ''; // Disable vault sync in tests

describe('Notes Service', () => {
  beforeAll(() => {
    initDb();
  });

  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM notes');
  });

  afterAll(() => {
    closeDb();
  });

  describe('createNote', () => {
    it('should create a note with content', () => {
      const note = notesService.createNote({
        content: 'Test note content'
      });

      expect(note.id).toMatch(/^note_/);
      expect(note.content).toBe('Test note content');
      expect(note.source).toBe('api');
      expect(note.created_at).toBeDefined();
    });

    it('should create a note with project and tags', () => {
      const note = notesService.createNote({
        content: 'Test note',
        project: 'my-project',
        tags: ['tag1', 'tag2']
      });

      expect(note.project).toBe('my-project');
      expect(note.tags).toBe('["tag1","tag2"]');
    });

    it('should sanitize project name', () => {
      const note = notesService.createNote({
        content: 'Test',
        project: 'My Project!'
      });

      expect(note.project).toBe('myproject');
    });
  });

  describe('getNoteById', () => {
    it('should return note by ID', () => {
      const created = notesService.createNote({ content: 'Find me' });
      const found = notesService.getNoteById(created.id);

      expect(found).not.toBeNull();
      expect(found?.content).toBe('Find me');
    });

    it('should return null for non-existent ID', () => {
      const found = notesService.getNoteById('note_nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('listNotes', () => {
    it('should list all notes', () => {
      notesService.createNote({ content: 'Note 1' });
      notesService.createNote({ content: 'Note 2' });
      notesService.createNote({ content: 'Note 3' });

      const result = notesService.listNotes({});

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by project', () => {
      notesService.createNote({ content: 'Note 1', project: 'project-a' });
      notesService.createNote({ content: 'Note 2', project: 'project-b' });

      const result = notesService.listNotes({ project: 'project-a' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.project).toBe('project-a');
    });

    it('should paginate results', () => {
      for (let i = 0; i < 5; i++) {
        notesService.createNote({ content: `Note ${i}` });
      }

      const page1 = notesService.listNotes({ limit: 2, offset: 0 });
      const page2 = notesService.listNotes({ limit: 2, offset: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    it('should search notes', () => {
      notesService.createNote({ content: 'This is about TypeScript' });
      notesService.createNote({ content: 'This is about Python' });

      const result = notesService.listNotes({ search: 'TypeScript' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.content).toContain('TypeScript');
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', () => {
      const note = notesService.createNote({ content: 'Delete me' });
      const deleted = notesService.deleteNote(note.id);

      expect(deleted).toBe(true);
      expect(notesService.getNoteById(note.id)).toBeNull();
    });

    it('should return false for non-existent note', () => {
      const deleted = notesService.deleteNote('note_nonexistent');
      expect(deleted).toBe(false);
    });
  });
});
