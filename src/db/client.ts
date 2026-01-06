import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.databasePath);

  // Enable foreign keys and WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  console.log(`Database initialized at ${config.databasePath}`);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of applied migrations
  const applied = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];
  const appliedSet = new Set(applied.map(m => m.name));

  // Read migration files
  const migrationsDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'migrations');

  // For Windows compatibility, handle the path
  const normalizedPath = migrationsDir.startsWith('/') && process.platform === 'win32'
    ? migrationsDir.slice(1)
    : migrationsDir;

  if (!fs.existsSync(normalizedPath)) {
    console.log('No migrations directory found, skipping file-based migrations');
    // Run inline initial migration
    runInitialMigration(database, appliedSet);
    return;
  }

  const files = fs.readdirSync(normalizedPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (!appliedSet.has(file)) {
      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(normalizedPath, file), 'utf-8');
      database.exec(sql);
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    }
  }

  // Also run inline migration if not applied
  runInitialMigration(database, appliedSet);
}

function runInitialMigration(database: Database.Database, appliedSet: Set<string>): void {
  const migrationName = '001_initial_inline';

  if (appliedSet.has(migrationName)) {
    return;
  }

  console.log('Applying inline initial migration...');

  database.exec(`
    -- API Keys
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'full',
      rate_limit INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      revoked_at DATETIME
    );

    -- Notes (quick thoughts)
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      project TEXT,
      tags TEXT,
      source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    -- Artifacts (code, docs)
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL,
      language TEXT,
      project TEXT,
      source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    -- Project context
    CREATE TABLE IF NOT EXISTS context (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL UNIQUE,
      summary TEXT,
      tech_stack TEXT,
      conventions TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks (synced with Obsidian)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      project TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      trust_level TEXT DEFAULT 'PROTOTYPE',
      priority TEXT DEFAULT 'NORMAL',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      api_key_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      ip_address TEXT,
      status_code INTEGER
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project);
    CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `);

  database.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName);
  console.log('Initial migration applied successfully');
}

// Export for testing
export function resetDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
