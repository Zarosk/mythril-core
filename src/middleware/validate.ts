import type { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation error response
 */
interface ValidationError {
  error: string;
  details: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Format Zod errors into a clean response
 */
function formatZodError(error: ZodError): ValidationError {
  return {
    error: 'Validation failed',
    details: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }))
  };
}

/**
 * Create a validation middleware for request body
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      request.body = schema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send(formatZodError(error));
      }
      return reply.status(400).send({ error: 'Invalid request body' });
    }
  };
}

/**
 * Create a validation middleware for query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      request.query = schema.parse(request.query);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send(formatZodError(error));
      }
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }
  };
}

/**
 * Create a validation middleware for route parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      request.params = schema.parse(request.params);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send(formatZodError(error));
      }
      return reply.status(400).send({ error: 'Invalid route parameters' });
    }
  };
}

// Common validation schemas
export const schemas = {
  // ID parameter
  id: z.object({
    id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format')
  }),

  // Project parameter
  project: z.object({
    project: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid project format')
  }),

  // Pagination query
  pagination: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0)
  }),

  // Search query
  search: z.object({
    q: z.string().min(1).max(200),
    types: z.string().optional().transform(val =>
      val ? val.split(',').filter(t => ['notes', 'artifacts', 'tasks'].includes(t)) : undefined
    ),
    project: z.string().max(100).optional(),
    limit: z.coerce.number().min(1).max(100).default(20)
  })
};

// Re-export zod for convenience
export { z };
