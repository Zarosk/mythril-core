import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(process.cwd(), 'logs');

/**
 * Patterns for secrets that should be redacted from logs
 */
const SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-_]+/g,        // Anthropic API keys
  /oads_live_[a-zA-Z0-9-_]+/g,     // OADS live API keys
  /oads_test_[a-zA-Z0-9-_]+/g,     // OADS test API keys
  /Bearer\s+[a-zA-Z0-9-_.]+/gi,    // Bearer tokens
  /api[_-]?key[=:]\s*["']?[a-zA-Z0-9-_]+["']?/gi, // Generic API keys
  /password[=:]\s*["']?[^"'\s]+["']?/gi,  // Passwords
  /secret[=:]\s*["']?[^"'\s]+["']?/gi,    // Secrets
  /token[=:]\s*["']?[a-zA-Z0-9-_.]+["']?/gi, // Tokens
];

/**
 * Redact secrets from a string
 */
function redactString(str: string): string {
  let result = str;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Recursively redact secrets from an object
 */
function redactObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return redactString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact values of sensitive keys entirely
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey === 'authorization'
      ) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactObject(value);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Winston format to redact secrets from log messages
 */
const redactSecrets = winston.format((info) => {
  // Redact message
  if (typeof info.message === 'string') {
    info.message = redactString(info.message);
  }

  // Redact metadata
  const redacted = redactObject(info) as winston.Logform.TransformableInfo;
  return redacted;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    redactSecrets(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'oads-brain' },
  transports: [
    // Console (colored, simple for dev)
    new winston.transports.Console({
      format: winston.format.combine(
        redactSecrets(),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length > 1
            ? ` ${JSON.stringify(meta)}`
            : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        })
      )
    }),
    // All logs (rotates daily, keeps 14 days)
    new DailyRotateFile({
      dirname: logDir,
      filename: 'brain-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d'
    }),
    // Errors only (separate file)
    new DailyRotateFile({
      dirname: logDir,
      filename: 'brain-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d'
    })
  ]
});

export default logger;
