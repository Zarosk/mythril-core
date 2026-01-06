import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import * as searchService from '../services/search.js';

// Validation schemas
const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200, 'Query too long'),
  types: z.string().optional().transform(val => {
    if (!val) return undefined;
    const types = val.split(',').filter(t => ['notes', 'artifacts', 'tasks'].includes(t));
    return types.length > 0 ? types as ('notes' | 'artifacts' | 'tasks')[] : undefined;
  }),
  project: z.string().max(100).optional(),
  limit: z.coerce.number().min(1).max(100).default(20)
});

const suggestQuerySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().min(1).max(10).default(5)
});

type SearchQuery = z.infer<typeof searchQuerySchema>;
type SuggestQuery = z.infer<typeof suggestQuerySchema>;

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware
  app.addHook('preHandler', authMiddleware);

  /**
   * GET /api/v1/search
   * Search across notes, artifacts, and tasks
   */
  app.get<{ Querystring: SearchQuery }>(
    '/api/v1/search',
    { preHandler: validateQuery(searchQuerySchema) },
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const results = searchService.search({
        q: request.query.q,
        types: request.query.types,
        project: request.query.project,
        limit: request.query.limit
      });

      audit('search.query', request);

      return reply.send({
        query: request.query.q,
        results,
        total: results.length
      });
    }
  );

  /**
   * GET /api/v1/search/suggest
   * Get search suggestions
   */
  app.get<{ Querystring: SuggestQuery }>(
    '/api/v1/search/suggest',
    { preHandler: validateQuery(suggestQuerySchema) },
    async (request: FastifyRequest<{ Querystring: SuggestQuery }>, reply: FastifyReply) => {
      const suggestions = searchService.getSuggestions(
        request.query.q,
        request.query.limit
      );

      return reply.send({ suggestions });
    }
  );
}
