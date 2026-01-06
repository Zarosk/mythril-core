import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams, schemas } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import * as tasksService from '../services/tasks.js';

// Validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(10000).optional(),
  project: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  trust_level: z.enum(['THROWAWAY', 'PROTOTYPE', 'MATURE']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional()
});

const queryTasksSchema = z.object({
  project: z.string().max(100).optional(),
  status: z.enum(['queued', 'active', 'completed', 'cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

type CreateTaskBody = z.infer<typeof createTaskSchema>;
type QueryTasksQuery = z.infer<typeof queryTasksSchema>;
type IdParams = z.infer<typeof schemas.id>;

export async function tasksRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware
  app.addHook('preHandler', authMiddleware);

  /**
   * POST /api/v1/tasks
   * Create a new task
   */
  app.post<{ Body: CreateTaskBody }>(
    '/api/v1/tasks',
    { preHandler: validateBody(createTaskSchema) },
    async (request: FastifyRequest<{ Body: CreateTaskBody }>, reply: FastifyReply) => {
      try {
        const task = tasksService.createTask({
          title: request.body.title,
          description: request.body.description,
          project: request.body.project,
          trust_level: request.body.trust_level,
          priority: request.body.priority
        });

        audit('task.create', request, 'task', task.id, 201);

        return reply.status(201).send(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create task';
        return reply.status(500).send({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/tasks
   * List tasks with pagination and filtering
   */
  app.get<{ Querystring: QueryTasksQuery }>(
    '/api/v1/tasks',
    { preHandler: validateQuery(queryTasksSchema) },
    async (request: FastifyRequest<{ Querystring: QueryTasksQuery }>, reply: FastifyReply) => {
      const result = tasksService.listTasks({
        project: request.query.project,
        status: request.query.status,
        limit: request.query.limit,
        offset: request.query.offset
      });

      audit('task.list', request);

      return reply.send({
        tasks: result.data,
        total: result.total,
        limit: result.limit,
        offset: result.offset
      });
    }
  );

  /**
   * GET /api/v1/tasks/:id
   * Get a single task by ID
   */
  app.get<{ Params: IdParams }>(
    '/api/v1/tasks/:id',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const task = tasksService.getTaskById(request.params.id);

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      audit('task.read', request, 'task', task.id);

      return reply.send(task);
    }
  );

  /**
   * POST /api/v1/tasks/:id/activate
   * Set a task as active
   */
  app.post<{ Params: IdParams }>(
    '/api/v1/tasks/:id/activate',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      try {
        const task = tasksService.activateTask(request.params.id);

        if (!task) {
          return reply.status(404).send({ error: 'Task not found' });
        }

        audit('task.activate', request, 'task', task.id);

        return reply.send(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to activate task';
        return reply.status(400).send({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/tasks/:id/complete
   * Mark a task as completed
   */
  app.post<{ Params: IdParams }>(
    '/api/v1/tasks/:id/complete',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const task = tasksService.completeTask(request.params.id);

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      audit('task.activate', request, 'task', task.id);

      return reply.send(task);
    }
  );

  /**
   * POST /api/v1/tasks/:id/cancel
   * Cancel a task
   */
  app.post<{ Params: IdParams }>(
    '/api/v1/tasks/:id/cancel',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const task = tasksService.cancelTask(request.params.id);

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      return reply.send(task);
    }
  );

  /**
   * DELETE /api/v1/tasks/:id
   * Delete a task
   */
  app.delete<{ Params: IdParams }>(
    '/api/v1/tasks/:id',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const deleted = tasksService.deleteTask(request.params.id);

      if (!deleted) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      audit('task.delete', request, 'task', request.params.id);

      return reply.send({ deleted: true });
    }
  );
}
