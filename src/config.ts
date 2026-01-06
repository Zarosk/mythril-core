import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer for environment variable: ${key}`);
  }
  return parsed;
}

export const config = {
  // Server
  port: getEnvInt('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // Database
  databasePath: getEnv('DATABASE_PATH', path.join(__dirname, '..', 'data', 'brain.db')),

  // Vault
  obsidianVaultPath: getEnv('OBSIDIAN_VAULT_PATH', ''),

  // Security
  apiKeySalt: getEnv('API_KEY_SALT', 'default-dev-salt-change-in-production'),

  // Rate limiting
  rateLimitMax: getEnvInt('RATE_LIMIT_MAX', 100),
  rateLimitWindowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),

  // App info
  version: '1.0.0',

  // Helper methods
  isDev(): boolean {
    return this.nodeEnv === 'development';
  },

  isProd(): boolean {
    return this.nodeEnv === 'production';
  }
} as const;

export type Config = typeof config;
