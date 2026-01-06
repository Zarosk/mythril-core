import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { configureRateLimit } from './middleware/rate-limit.js';
import { healthRoutes } from './routes/health.js';
import { notesRoutes } from './routes/notes.js';
import { artifactsRoutes } from './routes/artifacts.js';
import { contextRoutes } from './routes/context.js';
import { tasksRoutes } from './routes/tasks.js';
import { searchRoutes } from './routes/search.js';
import { feedbackRoutes } from './routes/feedback.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.isDev() ? 'info' : 'warn',
      transport: config.isDev()
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname'
            }
          }
        : undefined
    },
    trustProxy: true
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false // Allow API calls from anywhere
  });

  // CORS - use config-based origins in production
  const corsOrigins = config.isDev()
    ? true  // Allow all in development
    : config.corsOrigins.split(',').map(o => o.trim()).filter(Boolean);

  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    credentials: true
  });

  // Rate limiting
  await configureRateLimit(app);

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error(error);
    }

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      ...(config.isDev() && { stack: error.stack })
    });
  });

  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: 'Not Found',
      path: request.url
    });
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(notesRoutes);
  await app.register(artifactsRoutes);
  await app.register(contextRoutes);
  await app.register(tasksRoutes);
  await app.register(searchRoutes);
  await app.register(feedbackRoutes);

  return app;
}
