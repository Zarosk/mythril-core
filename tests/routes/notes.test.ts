import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { initDb, closeDb, getDb } from '../../src/db/client.js';
import { generateApiKey } from '../../src/security/api-keys.js';
import type { FastifyInstance } from 'fastify';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_PATH'] = ':memory:';

describe('Notes Routes', () => {
  let app: FastifyInstance;
  let apiKey: string;

  beforeAll(async () => {
    initDb();
    app = await buildApp();

    // Generate test API key
    const key = await generateApiKey('test', 'full', 1000);
    apiKey = key.key;
  });

  beforeEach(() => {
    // Clear notes between tests
    const db = getDb();
    db.exec('DELETE FROM notes');
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  describe('POST /api/v1/notes', () => {
    it('should require API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        payload: { content: 'Test note' }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create a note', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: {
          content: 'This is a test note',
          project: 'test-project',
          tags: ['test', 'example']
        }
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.id).toMatch(/^note_/);
      expect(body.created_at).toBeDefined();
    });

    it('should validate content is required', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate project format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: {
          content: 'Test',
          project: 'Invalid Project!'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/notes', () => {
    it('should list notes', async () => {
      // Create a note first
      await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'Test note 1' }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.notes).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('should filter by project', async () => {
      // Create notes in different projects
      await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'Note 1', project: 'project-a' }
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'Note 2', project: 'project-b' }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes?project=project-a',
        headers: { 'x-api-key': apiKey }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.notes).toHaveLength(1);
      expect(body.notes[0].project).toBe('project-a');
    });

    it('should search notes', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'This contains special keyword' }
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'This is just a regular note' }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes?search=special',
        headers: { 'x-api-key': apiKey }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.notes).toHaveLength(1);
      expect(body.notes[0].content).toContain('special');
    });
  });

  describe('GET /api/v1/notes/:id', () => {
    it('should get a note by ID', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'Test note' }
      });

      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/notes/${id}`,
        headers: { 'x-api-key': apiKey }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.id).toBe(id);
      expect(body.content).toBe('Test note');
    });

    it('should return 404 for non-existent note', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes/note_nonexistent',
        headers: { 'x-api-key': apiKey }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/notes/:id', () => {
    it('should delete a note', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/notes',
        headers: { 'x-api-key': apiKey },
        payload: { content: 'Test note to delete' }
      });

      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/notes/${id}`,
        headers: { 'x-api-key': apiKey }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.deleted).toBe(true);

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/notes/${id}`,
        headers: { 'x-api-key': apiKey }
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });
});
