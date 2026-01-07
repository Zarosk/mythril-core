import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import type { ApiKey } from '../types/index.js';

const SALT_ROUNDS = 12;

// New keys use mythril_ prefix, but we accept both for backward compatibility
const KEY_PREFIX = 'mythril_live_';
const VALID_PREFIXES = ['mythril_live_', 'mythril_test_', 'oads_live_', 'oads_test_'];

export interface GeneratedKey {
  id: string;
  name: string;
  key: string; // The raw key (only shown once)
  scope: ApiKey['scope'];
}

/**
 * Generate a new API key
 */
export async function generateApiKey(
  name: string,
  scope: ApiKey['scope'] = 'full',
  rateLimit: number = 100
): Promise<GeneratedKey> {
  const db = getDb();
  const id = `key_${nanoid(12)}`;
  const rawKey = `${KEY_PREFIX}${nanoid(32)}`;
  const keyHash = await bcrypt.hash(rawKey, SALT_ROUNDS);

  db.prepare(`
    INSERT INTO api_keys (id, name, key_hash, scope, rate_limit)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, keyHash, scope, rateLimit);

  return {
    id,
    name,
    key: rawKey,
    scope
  };
}

/**
 * Verify an API key and return the key record if valid
 * Returns the key record including revoked keys so the caller can check status
 * Accepts both mythril_ and oads_ prefixes for backward compatibility
 */
export async function verifyApiKey(rawKey: string): Promise<ApiKey | null> {
  if (!rawKey || !VALID_PREFIXES.some(prefix => rawKey.startsWith(prefix))) {
    return null;
  }

  const db = getDb();
  // Get all keys including revoked ones to allow proper error messages
  const keys = db.prepare(`
    SELECT * FROM api_keys
  `).all() as ApiKey[];

  for (const key of keys) {
    const isValid = await bcrypt.compare(rawKey, key.key_hash);
    if (isValid) {
      return key;
    }
  }

  return null;
}

/**
 * Update the last_used_at timestamp for a key
 */
export function updateLastUsed(keyId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(keyId);
}

/**
 * Revoke an API key
 */
export function revokeApiKey(keyId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL
  `).run(keyId);

  return result.changes > 0;
}

/**
 * List all API keys (without hashes)
 */
export function listApiKeys(): Omit<ApiKey, 'key_hash'>[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, scope, rate_limit, created_at, last_used_at, revoked_at
    FROM api_keys
    ORDER BY created_at DESC
  `).all() as Omit<ApiKey, 'key_hash'>[];
}

/**
 * Get a single API key by ID (without hash)
 */
export function getApiKeyById(keyId: string): Omit<ApiKey, 'key_hash'> | null {
  const db = getDb();
  const result = db.prepare(`
    SELECT id, name, scope, rate_limit, created_at, last_used_at, revoked_at
    FROM api_keys WHERE id = ?
  `).get(keyId) as Omit<ApiKey, 'key_hash'> | undefined;

  return result || null;
}
