/**
 * Input sanitization utilities
 * Prevents XSS, SQL injection, and other malicious input
 */

// Characters that could be used for SQL injection
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|SCRIPT)\b)/gi,
  /(--|;|\/\*|\*\/|@@|@)/g,
  /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/gi
];

// HTML/Script injection patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<[^>]+>/g
];

/**
 * Sanitize a string for safe database storage
 * This is a secondary defense - parameterized queries are the primary defense
 */
export function sanitizeForDb(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Escape single quotes (for SQLite)
  return input.replace(/'/g, "''");
}

/**
 * Check if input contains potential SQL injection
 */
export function hasSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check if input contains potential XSS
 */
export function hasXss(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize HTML from input (removes all HTML tags)
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return input.replace(/[&<>"'`=/]/g, char => htmlEntities[char] ?? char);
}

/**
 * Sanitize a project name (alphanumeric, hyphens, underscores only)
 */
export function sanitizeProjectName(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input.toLowerCase().replace(/[^a-z0-9-_]/g, '');
}

/**
 * Sanitize tags array
 */
export function sanitizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter(tag => typeof tag === 'string')
    .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''))
    .filter(tag => tag.length > 0 && tag.length <= 50)
    .slice(0, 20); // Max 20 tags
}

/**
 * Truncate string to maximum length
 */
export function truncate(input: string, maxLength: number): string {
  if (typeof input !== 'string') {
    return '';
  }

  if (input.length <= maxLength) {
    return input;
  }

  return input.slice(0, maxLength);
}

/**
 * Validate and sanitize content (notes, artifacts)
 * Allows markdown but strips dangerous HTML
 */
export function sanitizeContent(input: string, maxLength: number = 50000): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Strip script and iframe tags but preserve other content
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // Truncate if too long
  return truncate(sanitized, maxLength);
}

/**
 * Validate that input is a safe ID (alphanumeric with underscores/hyphens)
 */
export function isValidId(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return /^[a-zA-Z0-9_-]+$/.test(input) && input.length >= 1 && input.length <= 100;
}
