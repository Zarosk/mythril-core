import { nanoid } from 'nanoid';
import { getDb } from '../db/client.js';
import { sanitizeContent } from '../security/sanitize.js';
import logger from '../utils/logger.js';

export interface Feedback {
  id: string;
  message: string;
  user_id: string;
  username: string;
  guild_name: string | null;
  created_at: string;
}

export interface CreateFeedbackInput {
  message: string;
  user_id: string;
  username: string;
  guild_name?: string;
}

export interface FeedbackListQuery {
  limit?: number;
  offset?: number;
}

export interface PaginatedFeedback {
  data: Feedback[];
  total: number;
  limit: number;
  offset: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetIn?: number; // seconds until reset
}

const DAILY_LIMIT = 2;
const DAY_IN_SECONDS = 86400;

/**
 * Check if user can submit feedback (rate limit: 2 per 24 hours)
 */
export function checkRateLimit(userId: string): RateLimitResult {
  const db = getDb();
  const oneDayAgo = new Date(Date.now() - DAY_IN_SECONDS * 1000).toISOString();

  const result = db.prepare(`
    SELECT COUNT(*) as count, MAX(created_at) as last_submitted
    FROM feedback
    WHERE user_id = ? AND created_at > ?
  `).get(userId, oneDayAgo) as { count: number; last_submitted: string | null };

  const used = result.count;
  const remaining = Math.max(0, DAILY_LIMIT - used);

  if (remaining === 0 && result.last_submitted) {
    // Calculate reset time from the oldest feedback within the window
    const oldest = db.prepare(`
      SELECT MIN(created_at) as oldest
      FROM feedback
      WHERE user_id = ? AND created_at > ?
    `).get(userId, oneDayAgo) as { oldest: string };

    const oldestDate = new Date(oldest.oldest);
    const resetAt = new Date(oldestDate.getTime() + DAY_IN_SECONDS * 1000);
    const resetIn = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

    return {
      allowed: false,
      remaining: 0,
      limit: DAILY_LIMIT,
      resetIn: Math.max(0, resetIn),
    };
  }

  return {
    allowed: true,
    remaining,
    limit: DAILY_LIMIT,
  };
}

/**
 * Create new feedback
 */
export function createFeedback(input: CreateFeedbackInput): Feedback {
  const db = getDb();
  const id = `fb_${nanoid(12)}`;
  const now = new Date().toISOString();

  const message = sanitizeContent(input.message);
  const guildName = input.guild_name ?? null;

  db.prepare(`
    INSERT INTO feedback (id, message, user_id, username, guild_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, message, input.user_id, input.username, guildName, now);

  const feedback = getFeedbackById(id);
  if (!feedback) {
    throw new Error('Failed to create feedback');
  }

  logger.info('Feedback created', { id, userId: input.user_id });
  return feedback;
}

/**
 * Get feedback by ID
 */
export function getFeedbackById(id: string): Feedback | null {
  const db = getDb();
  const result = db.prepare(`
    SELECT * FROM feedback WHERE id = ?
  `).get(id) as Feedback | undefined;

  return result ?? null;
}

/**
 * List all feedback (admin only)
 */
export function listFeedback(query: FeedbackListQuery): PaginatedFeedback {
  const db = getDb();
  const { limit = 20, offset = 0 } = query;

  const feedback = db.prepare(`
    SELECT * FROM feedback
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Feedback[];

  const totalResult = db.prepare(`
    SELECT COUNT(*) as total FROM feedback
  `).get() as { total: number };

  return {
    data: feedback,
    total: totalResult.total,
    limit,
    offset,
  };
}
