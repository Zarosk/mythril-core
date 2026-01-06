import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, requireFullScope } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import * as feedbackService from '../services/feedback.js';

// Validation schemas
const createFeedbackSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long (max 1000 characters)'),
  user_id: z.string().min(1, 'User ID is required').max(100),
  username: z.string().min(1, 'Username is required').max(100),
  guild_name: z.string().max(100).optional(),
});

const queryFeedbackSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

type CreateFeedbackBody = z.infer<typeof createFeedbackSchema>;
type QueryFeedbackQuery = z.infer<typeof queryFeedbackSchema>;

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  app.addHook('preHandler', authMiddleware);

  /**
   * POST /api/v1/feedback
   * Submit feedback (rate limited: 2 per user per 24 hours)
   */
  app.post<{ Body: CreateFeedbackBody }>(
    '/api/v1/feedback',
    { preHandler: validateBody(createFeedbackSchema) },
    async (request: FastifyRequest<{ Body: CreateFeedbackBody }>, reply: FastifyReply) => {
      const { message, user_id, username, guild_name } = request.body;

      // Check rate limit
      const rateLimit = feedbackService.checkRateLimit(user_id);

      // Set rate limit headers
      reply.header('x-ratelimit-limit', rateLimit.limit.toString());
      reply.header('x-ratelimit-remaining', rateLimit.remaining.toString());

      if (!rateLimit.allowed) {
        audit('feedback.rate_limited', request, 'feedback', user_id, 429);
        return reply.status(429).send({
          error: 'Rate limit exceeded',
          message: `You can only submit ${rateLimit.limit} feedback per 24 hours`,
          resetIn: rateLimit.resetIn,
        });
      }

      try {
        const feedback = feedbackService.createFeedback({
          message,
          user_id,
          username,
          guild_name,
        });

        // Update remaining count after submission
        reply.header('x-ratelimit-remaining', (rateLimit.remaining - 1).toString());

        audit('feedback.create', request, 'feedback', feedback.id, 201);

        return reply.status(201).send({
          id: feedback.id,
          created_at: feedback.created_at,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create feedback';
        return reply.status(500).send({ error: errorMessage });
      }
    }
  );

  /**
   * GET /api/v1/feedback
   * List all feedback (admin only - requires full scope)
   */
  app.get<{ Querystring: QueryFeedbackQuery }>(
    '/api/v1/feedback',
    { preHandler: validateQuery(queryFeedbackSchema) },
    async (request: FastifyRequest<{ Querystring: QueryFeedbackQuery }>, reply: FastifyReply) => {
      // Require full scope for listing feedback
      if (!requireFullScope(request, reply)) {
        return;
      }

      const result = feedbackService.listFeedback({
        limit: request.query.limit,
        offset: request.query.offset,
      });

      audit('feedback.list', request);

      return reply.send({
        feedback: result.data,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    }
  );
}
