import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams, schemas } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import * as contextService from '../services/context.js';

// Validation schemas
const updateContextSchema = z.object({
  summary: z.string().max(10000).optional(),
  tech_stack: z.array(z.string().max(100)).max(50).optional(),
  conventions: z.string().max(10000).optional()
});

type UpdateContextBody = z.infer<typeof updateContextSchema>;
type ProjectParams = z.infer<typeof schemas.project>;

export async function contextRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware
  app.addHook('preHandler', authMiddleware);

  /**
   * GET /api/v1/context/:project
   * Get project context with recent notes and artifacts
   */
  app.get<{ Params: ProjectParams }>(
    '/api/v1/context/:project',
    { preHandler: validateParams(schemas.project) },
    async (request: FastifyRequest<{ Params: ProjectParams }>, reply: FastifyReply) => {
      const context = contextService.getContext(request.params.project);

      if (!context) {
        return reply.status(400).send({ error: 'Invalid project name' });
      }

      audit('context.read', request, 'context', request.params.project);

      return reply.send(context);
    }
  );

  /**
   * PUT /api/v1/context/:project
   * Update project context
   */
  app.put<{ Params: ProjectParams; Body: UpdateContextBody }>(
    '/api/v1/context/:project',
    { preHandler: [validateParams(schemas.project), validateBody(updateContextSchema)] },
    async (request: FastifyRequest<{ Params: ProjectParams; Body: UpdateContextBody }>, reply: FastifyReply) => {
      const context = contextService.updateContext(request.params.project, request.body);

      if (!context) {
        return reply.status(400).send({ error: 'Invalid project name' });
      }

      audit('context.update', request, 'context', request.params.project);

      return reply.send(context);
    }
  );

  /**
   * GET /api/v1/projects
   * List all projects
   */
  app.get(
    '/api/v1/projects',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const projects = contextService.getAllProjects();

      return reply.send({ projects });
    }
  );

  /**
   * GET /api/v1/contexts
   * List all project contexts
   */
  app.get(
    '/api/v1/contexts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const contexts = contextService.listContexts();

      return reply.send({ contexts });
    }
  );
}
