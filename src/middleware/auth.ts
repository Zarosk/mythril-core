import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyApiKey, updateLastUsed } from '../security/api-keys.js';
import { audit } from '../security/audit.js';

/**
 * Authentication middleware that verifies API keys
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    audit('auth.missing_key', request, undefined, undefined, 401);
    return reply.status(401).send({ error: 'API key required' });
  }

  const keyRecord = await verifyApiKey(apiKey);

  if (!keyRecord) {
    audit('auth.invalid_key', request, undefined, undefined, 401);
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  if (keyRecord.revoked_at) {
    audit('auth.revoked_key', request, undefined, undefined, 401);
    return reply.status(401).send({ error: 'API key has been revoked' });
  }

  // Update last used timestamp (fire and forget)
  updateLastUsed(keyRecord.id);

  // Attach key record to request for downstream use
  request.apiKey = keyRecord;

  // Log successful auth
  audit('auth.success', request);
}

/**
 * Check if request has write permissions
 */
export function requireWriteScope(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  if (!request.apiKey) {
    reply.status(401).send({ error: 'Not authenticated' });
    return false;
  }

  if (request.apiKey.scope === 'read') {
    reply.status(403).send({ error: 'Insufficient permissions. Write access required.' });
    return false;
  }

  return true;
}

/**
 * Check if request has full permissions
 */
export function requireFullScope(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  if (!request.apiKey) {
    reply.status(401).send({ error: 'Not authenticated' });
    return false;
  }

  if (request.apiKey.scope !== 'full') {
    reply.status(403).send({ error: 'Insufficient permissions. Full access required.' });
    return false;
  }

  return true;
}
