import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';
import { audit } from '../security/audit.js';
import logger from '../utils/logger.js';

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

    // Custom error response with detailed info
    errorResponseBuilder: (request: FastifyRequest, context) => {
      const resetAtMs = Date.now() + context.ttl;
      const resetAt = new Date(resetAtMs).toISOString();
      const resetIn = Math.ceil(context.ttl / 1000);

      audit('rate_limit.exceeded', request, undefined, undefined, 429);

      logger.warn('Rate limit exceeded', {
        keyId: request.apiKey?.id,
        ip: request.ip,
        limit: context.max,
        resetIn,
        path: request.url
      });

      return {
        error: 'Rate limit exceeded',
        limit: context.max,
        remaining: 0,
        resetIn,
        resetAt
      };
    },

    // Custom hook to log when approaching limit
    onExceeding: (request: FastifyRequest, key: string) => {
      // This fires when limit is about to be exceeded
      logger.warn('Rate limit approaching', {
        key,
        path: request.url
      });
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

  // Add hook to log when usage is high (>80%)
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const limit = reply.getHeader('x-ratelimit-limit');
    const remaining = reply.getHeader('x-ratelimit-remaining');

    if (limit && remaining !== undefined) {
      const limitNum = Number(limit);
      const remainingNum = Number(remaining);
      const usagePercent = ((limitNum - remainingNum) / limitNum) * 100;

      if (usagePercent >= 80 && usagePercent < 100) {
        logger.info('Rate limit high usage', {
          keyId: request.apiKey?.id,
          ip: request.ip,
          used: limitNum - remainingNum,
          limit: limitNum,
          remaining: remainingNum,
          usagePercent: Math.round(usagePercent)
        });
      }
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
