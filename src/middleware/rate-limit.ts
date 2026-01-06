import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';
import { audit } from '../security/audit.js';

/**
 * Configure rate limiting for the Fastify instance
 */
export async function configureRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,

    // Use API key ID if available, otherwise use IP
    keyGenerator: (request: FastifyRequest): string => {
      return request.apiKey?.id ?? request.ip;
    },

    // Custom error response
    errorResponseBuilder: (request: FastifyRequest, context) => {
      audit('rate_limit.exceeded', request, undefined, undefined, 429);

      return {
        error: 'Too many requests',
        retry_after: Math.ceil(context.ttl / 1000),
        limit: context.max,
        remaining: 0
      };
    },

    // Add rate limit headers
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true
    },

    // Skip rate limiting for health endpoint
    skipOnError: false,
    allowList: (request: FastifyRequest): boolean => {
      // Don't rate limit health checks
      return request.url === '/health';
    }
  });
}

/**
 * Get rate limit config for specific API key
 * Can be used for per-key rate limiting
 */
export function getKeyRateLimit(request: FastifyRequest): number {
  return request.apiKey?.rate_limit ?? config.rateLimitMax;
}
