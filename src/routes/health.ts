import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { isVaultSyncEnabled } from '../services/vault-sync.js';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  services: {
    database: boolean;
    vault_sync: boolean;
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Returns server health status (no auth required)
   */
  app.get<{ Reply: HealthResponse }>(
    '/health',
    async (_request, reply) => {
      const vaultEnabled = isVaultSyncEnabled();

      const response: HealthResponse = {
        status: 'ok',
        version: config.version,
        timestamp: new Date().toISOString(),
        services: {
          database: true, // If we reach here, DB is working
          vault_sync: vaultEnabled
        }
      };

      // Set status to degraded if vault sync is expected but not working
      if (config.obsidianVaultPath && !vaultEnabled) {
        response.status = 'degraded';
      }

      return reply.send(response);
    }
  );

  /**
   * GET /
   * Root endpoint - redirects to health or shows basic info
   */
  app.get('/', async (_request, reply) => {
    return reply.send({
      name: 'OADS Brain API',
      version: config.version,
      docs: '/health'
    });
  });
}
