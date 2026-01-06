import { beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, getDb, resetDb } from '../src/db/client.js';
import { generateApiKey } from '../src/security/api-keys.js';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_PATH'] = ':memory:';

// Global test API key
export let testApiKey: string;

beforeAll(async () => {
  // Initialize in-memory database
  initDb();

  // Generate a test API key
  const key = await generateApiKey('test', 'full', 1000);
  testApiKey = key.key;
});

beforeEach(() => {
  // Clear data between tests (keep schema and api_keys)
  const db = getDb();
  db.exec('DELETE FROM notes');
  db.exec('DELETE FROM artifacts');
  db.exec('DELETE FROM context');
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM audit_log');
});

afterAll(() => {
  closeDb();
});
