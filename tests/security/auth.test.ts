import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { initDb, closeDb } from '../../src/db/client.js';
import { generateApiKey, revokeApiKey } from '../../src/security/api-keys.js';
import type { FastifyInstance } from 'fastify';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_PATH'] = ':memory:';

describe('Authentication', () => {
  let app: FastifyInstance;
  let validApiKey: string;
  let revokedKeyId: string;
  let revokedApiKey: string;

  beforeAll(async () => {
    initDb();
    app = await buildApp();

    // Generate valid API key
    const key = await generateApiKey('test-valid', 'full', 1000);
    validApiKey = key.key;

    // Generate and revoke an API key
    const revokedKey = await generateApiKey('test-revoked', 'full', 1000);
    revokedKeyId = revokedKey.id;
    revokedApiKey = revokedKey.key;
    revokeApiKey(revokedKeyId);
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  describe('API Key Validation', () => {
    it('should reject requests without API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes'
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('API key required');
    });

    it('should reject invalid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes',
        headers: { 'x-api-key': 'oads_live_invalid_key_12345' }
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid API key');
    });

    it('should reject revoked API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes',
        headers: { 'x-api-key': revokedApiKey }
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('API key has been revoked');
    });

    it('should accept valid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes',
        headers: { 'x-api-key': validApiKey }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow health endpoint without API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Key Format Validation', () => {
    it('should reject key without proper prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notes',
        headers: { 'x-api-key': 'invalid_prefix_key' }
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
