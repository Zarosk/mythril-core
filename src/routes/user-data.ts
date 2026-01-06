import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateParams } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import { getDb } from '../db/client.js';
import logger from '../utils/logger.js';

// Validation schemas
const discordIdSchema = z.object({
  discordId: z.string().min(1).max(30).regex(/^\d+$/, 'Discord ID must be numeric'),
});

type DiscordIdParams = z.infer<typeof discordIdSchema>;

/**
 * Initialize discord_users table if it doesn't exist
 */
function ensureUserTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS discord_users (
      discord_id TEXT PRIMARY KEY,
      subscribed INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get or create user record
 */
function getOrCreateUser(discordId: string): { discord_id: string; subscribed: number } {
  const db = getDb();

  let user = db.prepare(`
    SELECT * FROM discord_users WHERE discord_id = ?
  `).get(discordId) as { discord_id: string; subscribed: number } | undefined;

  if (!user) {
    db.prepare(`
      INSERT INTO discord_users (discord_id, subscribed) VALUES (?, 1)
    `).run(discordId);
    user = { discord_id: discordId, subscribed: 1 };
  }

  return user;
}

export async function userDataRoutes(app: FastifyInstance): Promise<void> {
  // Ensure table exists
  ensureUserTable();

  // Apply auth middleware to all routes in this plugin
  app.addHook('preHandler', authMiddleware);

  /**
   * POST /api/v1/users/:discordId/unsubscribe
   * Unsubscribe user from notifications
   */
  app.post<{ Params: DiscordIdParams }>(
    '/api/v1/users/:discordId/unsubscribe',
    { preHandler: validateParams(discordIdSchema) },
    async (request: FastifyRequest<{ Params: DiscordIdParams }>, reply: FastifyReply) => {
      const { discordId } = request.params;
      const db = getDb();

      try {
        const user = getOrCreateUser(discordId);

        if (user.subscribed === 0) {
          audit('user.unsubscribe.already', request, 'user', discordId);
          return reply.send({ success: true, alreadyUnsubscribed: true });
        }

        db.prepare(`
          UPDATE discord_users
          SET subscribed = 0, updated_at = datetime('now')
          WHERE discord_id = ?
        `).run(discordId);

        logger.info('User unsubscribed', { discordId });
        audit('user.unsubscribe', request, 'user', discordId);

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to unsubscribe user', { discordId, error });
        return reply.status(500).send({ error: 'Failed to unsubscribe' });
      }
    }
  );

  /**
   * POST /api/v1/users/:discordId/resubscribe
   * Resubscribe user to notifications
   */
  app.post<{ Params: DiscordIdParams }>(
    '/api/v1/users/:discordId/resubscribe',
    { preHandler: validateParams(discordIdSchema) },
    async (request: FastifyRequest<{ Params: DiscordIdParams }>, reply: FastifyReply) => {
      const { discordId } = request.params;
      const db = getDb();

      try {
        const user = getOrCreateUser(discordId);

        if (user.subscribed === 1) {
          audit('user.resubscribe.already', request, 'user', discordId);
          return reply.send({ success: true, alreadySubscribed: true });
        }

        db.prepare(`
          UPDATE discord_users
          SET subscribed = 1, updated_at = datetime('now')
          WHERE discord_id = ?
        `).run(discordId);

        logger.info('User resubscribed', { discordId });
        audit('user.resubscribe', request, 'user', discordId);

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to resubscribe user', { discordId, error });
        return reply.status(500).send({ error: 'Failed to resubscribe' });
      }
    }
  );

  /**
   * DELETE /api/v1/users/:discordId/data
   * Delete all user data
   */
  app.delete<{ Params: DiscordIdParams }>(
    '/api/v1/users/:discordId/data',
    { preHandler: validateParams(discordIdSchema) },
    async (request: FastifyRequest<{ Params: DiscordIdParams }>, reply: FastifyReply) => {
      const { discordId } = request.params;
      const db = getDb();

      try {
        // Delete from discord_users table
        const subscriptionResult = db.prepare(`
          DELETE FROM discord_users WHERE discord_id = ?
        `).run(discordId);

        // Delete notes created by this user via discord
        // Notes don't have discord_id directly, but we can check source
        // For now, we only delete the subscription record
        // Future: Add discord_id tracking to notes for full data deletion

        const deleted = {
          subscriptions: subscriptionResult.changes,
          notes: 0, // Would need discord_id tracking in notes table
        };

        logger.info('User data deleted', { discordId, deleted });
        audit('user.delete_data', request, 'user', discordId);

        return reply.send({ success: true, deleted });
      } catch (error) {
        logger.error('Failed to delete user data', { discordId, error });
        return reply.status(500).send({ error: 'Failed to delete data' });
      }
    }
  );

  /**
   * GET /api/v1/users/:discordId/subscription
   * Check user subscription status
   */
  app.get<{ Params: DiscordIdParams }>(
    '/api/v1/users/:discordId/subscription',
    { preHandler: validateParams(discordIdSchema) },
    async (request: FastifyRequest<{ Params: DiscordIdParams }>, reply: FastifyReply) => {
      const { discordId } = request.params;

      try {
        const user = getOrCreateUser(discordId);

        audit('user.check_subscription', request, 'user', discordId);

        return reply.send({
          discordId,
          subscribed: user.subscribed === 1,
        });
      } catch (error) {
        logger.error('Failed to check subscription', { discordId, error });
        return reply.status(500).send({ error: 'Failed to check subscription' });
      }
    }
  );
}
