import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams, schemas } from '../middleware/validate.js';
import { audit } from '../security/audit.js';
import * as notesService from '../services/notes.js';
import type { Note, PaginatedResponse } from '../types/index.js';

// Validation schemas
const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').max(50000, 'Content too long'),
  project: z.string().max(100).regex(/^[a-z0-9-]*$/, 'Project must be lowercase alphanumeric with hyphens').optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  source: z.string().max(50).optional()
});

const queryNotesSchema = z.object({
  project: z.string().max(100).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().max(200).optional()
});

type CreateNoteBody = z.infer<typeof createNoteSchema>;
type QueryNotesQuery = z.infer<typeof queryNotesSchema>;
type IdParams = z.infer<typeof schemas.id>;

export async function notesRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  app.addHook('preHandler', authMiddleware);

  /**
   * POST /api/v1/notes
   * Create a new note
   */
  app.post<{ Body: CreateNoteBody }>(
    '/api/v1/notes',
    { preHandler: validateBody(createNoteSchema) },
    async (request: FastifyRequest<{ Body: CreateNoteBody }>, reply: FastifyReply) => {
      try {
        const note = notesService.createNote({
          content: request.body.content,
          project: request.body.project,
          tags: request.body.tags,
          source: request.body.source ?? 'api'
        });

        audit('note.create', request, 'note', note.id, 201);

        return reply.status(201).send({
          id: note.id,
          created_at: note.created_at
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create note';
        return reply.status(500).send({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/notes
   * List notes with pagination and filtering
   */
  app.get<{ Querystring: QueryNotesQuery }>(
    '/api/v1/notes',
    { preHandler: validateQuery(queryNotesSchema) },
    async (request: FastifyRequest<{ Querystring: QueryNotesQuery }>, reply: FastifyReply) => {
      const result = notesService.listNotes({
        project: request.query.project,
        limit: request.query.limit,
        offset: request.query.offset,
        search: request.query.search
      });

      audit('note.list', request);

      return reply.send({
        notes: result.data,
        total: result.total,
        limit: result.limit,
        offset: result.offset
      });
    }
  );

  /**
   * GET /api/v1/notes/:id
   * Get a single note by ID
   */
  app.get<{ Params: IdParams }>(
    '/api/v1/notes/:id',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const note = notesService.getNoteById(request.params.id);

      if (!note) {
        return reply.status(404).send({ error: 'Note not found' });
      }

      audit('note.read', request, 'note', note.id);

      return reply.send(note);
    }
  );

  /**
   * DELETE /api/v1/notes/:id
   * Delete a note
   */
  app.delete<{ Params: IdParams }>(
    '/api/v1/notes/:id',
    { preHandler: validateParams(schemas.id) },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const deleted = notesService.deleteNote(request.params.id);

      if (!deleted) {
        return reply.status(404).send({ error: 'Note not found' });
      }

      audit('note.delete', request, 'note', request.params.id);

      return reply.send({ deleted: true });
    }
  );
}
