import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams, schemas } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import * as artifactsService from '../services/artifacts.js';

// Validation schemas
const createArtifactSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(500000, 'Content too long'),
  content_type: z.enum(['code', 'markdown', 'json']),
  language: z.string().max(50).optional(),
  project: z.string().max(100).regex(/^[a-z0-9-]*$/).optional(),
  source: z.string().max(50).optional()
});

const updateArtifactSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(500000).optional(),
  content_type: z.enum(['code', 'markdown', 'json']).optional(),
  language: z.string().max(50).optional(),
  project: z.string().max(100).regex(/^[a-z0-9-]*$/).optional()
});

const queryArtifactsSchema = z.object({
  project: z.string().max(100).optional(),
  content_type: z.enum(['code', 'markdown', 'json']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().max(200).optional()
});

type CreateArtifactBody = z.infer<typeof createArtifactSchema>;
type UpdateArtifactBody = z.infer<typeof updateArtifactSchema>;
type QueryArtifactsQuery = z.infer<typeof queryArtifactsSchema>;
type IdParams = z.infer<typeof schemas.id>;

export async function artifactsRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware
  app.addHook('preHandler', authMiddleware);

  /**
   * POST /api/v1/artifacts
   * Create a new artifact
   */
  app.post<{ Body: CreateArtifactBody }>(
    '/api/v1/artifacts',
    { preHandler: validateBody(createArtifactSchema) },
    async (request: FastifyRequest<{ Body: CreateArtifactBody }>, reply: FastifyReply) => {
      try {
        const artifact = artifactsService.createArtifact({
          title: request.body.title,
          content: request.body.content,
          content_type: request.body.content_type,
          language: request.body.language,
          project: request.body.project,
          source: request.body.source ?? 'api'
        });

        audit('artifact.create', request, 'artifact', artifact.id, 201);

        return reply.status(201).send({
          id: artifact.id,
          created_at: artifact.created_at
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create artifact';
        return reply.status(500).send({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/artifacts
   * List artifacts with pagination and filtering
   */
  app.get<{ Querystring: QueryArtifactsQuery }>(
    '/api/v1/artifacts',
    { preHandler: validateQuery(queryArtifactsSchema) },
    async (request: FastifyRequest<{ Querystring: QueryArtifactsQuery }>, reply: FastifyReply) => {
      const result = artifactsService.listArtifacts({
        project: request.query.project,
        content_type: request.query.content_type,
        limit: request.query.limit,
        offset: request.query.offset,
        search: request.query.search
      });

      audit('artifact.list', request);

      return reply.send({
        artifacts: result.data,
        total: result.total,
        limit: result.limit,
        offset: result.offset
      });
    }
  );

  /**
   * GET /api/v1/artifacts/:id
   * Get a single artifact by ID
   */
  app.get<{ Params: IdParams }>(
    '/api/v1/artifacts/:id',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const artifact = artifactsService.getArtifactById(request.params.id);

      if (!artifact) {
        return reply.status(404).send({ error: 'Artifact not found' });
      }

      audit('artifact.read', request, 'artifact', artifact.id);

      return reply.send(artifact);
    }
  );

  /**
   * PUT /api/v1/artifacts/:id
   * Update an artifact
   */
  app.put<{ Params: IdParams; Body: UpdateArtifactBody }>(
    '/api/v1/artifacts/:id',
    { preHandler: [validateParams(schemas.id), validateBody(updateArtifactSchema)] },
    async (request: FastifyRequest<{ Params: IdParams; Body: UpdateArtifactBody }>, reply: FastifyReply) => {
      const artifact = artifactsService.updateArtifact(request.params.id, request.body);

      if (!artifact) {
        return reply.status(404).send({ error: 'Artifact not found' });
      }

      audit('artifact.update', request, 'artifact', artifact.id);

      return reply.send(artifact);
    }
  );

  /**
   * DELETE /api/v1/artifacts/:id
   * Delete an artifact
   */
  app.delete<{ Params: IdParams }>(
    '/api/v1/artifacts/:id',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const deleted = artifactsService.deleteArtifact(request.params.id);

      if (!deleted) {
        return reply.status(404).send({ error: 'Artifact not found' });
      }

      audit('artifact.delete', request, 'artifact', request.params.id);

      return reply.send({ deleted: true });
    }
  );
}
