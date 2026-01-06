import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { initDb, closeDb } from '../../src/db/client.js';
import type { FastifyInstance } from 'fastify';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_PATH'] = ':memory:';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    initDb();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(body.services.database).toBe(true);
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.name).toBe('OADS Brain API');
      expect(body.version).toBeDefined();
    });
  });
});
