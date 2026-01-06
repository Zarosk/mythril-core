# OADS Brain API - Claude Context

## What is this?

This is the **OADS Brain API** - an HTTP API server that serves as the central hub for capturing and organizing notes, artifacts, and tasks across multiple platforms (iPhone, Discord, web browser). It syncs data to an Obsidian vault for persistence and accessibility.

## Tech Stack

- **Node.js 20+** with **TypeScript** (strict mode)
- **Fastify** for HTTP server
- **SQLite** via better-sqlite3 for data storage
- **Zod** for runtime validation
- **bcrypt** for API key hashing
- **Vitest** for testing

## Key Architecture Decisions

1. **SQLite over PostgreSQL**: Chosen for simplicity and portability. Single-file database that's easy to backup and doesn't require a separate server.

2. **API Keys over JWT**: Simpler auth model suitable for this use case. Keys are bcrypt-hashed and stored in the database.

3. **Vault Sync**: All notes, artifacts, and tasks are mirrored to Obsidian markdown files. This allows:
   - Human-readable backups
   - Claude Desktop MCP integration
   - Direct editing in Obsidian

4. **Audit Logging**: All API requests are logged for debugging and security monitoring.

## Project Structure

```
src/
├── index.ts          # Entry point - starts server
├── config.ts         # Environment variable handling
├── app.ts            # Fastify app configuration
├── routes/           # HTTP route handlers
│   ├── health.ts     # GET /health (no auth)
│   ├── notes.ts      # CRUD /api/v1/notes
│   ├── artifacts.ts  # CRUD /api/v1/artifacts
│   ├── context.ts    # GET/PUT /api/v1/context/:project
│   ├── tasks.ts      # CRUD /api/v1/tasks
│   └── search.ts     # GET /api/v1/search
├── middleware/       # Request processing
│   ├── auth.ts       # API key verification
│   ├── rate-limit.ts # Request throttling
│   └── validate.ts   # Zod validation wrapper
├── services/         # Business logic
│   ├── notes.ts      # Note operations
│   ├── artifacts.ts  # Artifact operations
│   ├── context.ts    # Project context
│   ├── tasks.ts      # Task management
│   ├── search.ts     # Cross-entity search
│   └── vault-sync.ts # Obsidian file sync
├── db/
│   ├── client.ts     # SQLite connection & migrations
│   └── migrations/   # SQL migration files
├── security/
│   ├── api-keys.ts   # Key generation & verification
│   ├── audit.ts      # Request logging
│   └── sanitize.ts   # Input sanitization
└── types/
    └── index.ts      # TypeScript interfaces
```

## Common Tasks

### Adding a new endpoint

1. Create route handler in `src/routes/`
2. Define Zod schemas for validation
3. Add to `src/app.ts` registration
4. Add tests in `tests/routes/`

### Adding a new database table

1. Add SQL to `src/db/migrations/` (new file with incremented number)
2. Add TypeScript types to `src/types/index.ts`
3. Create service in `src/services/`
4. Add vault sync function if needed

### Debugging

- Check `data/brain.db` with any SQLite client
- Audit log is in the `audit_log` table
- Set `NODE_ENV=development` for verbose logging

## API Authentication

All `/api/v1/*` routes require:
```
X-API-Key: oads_live_xxxxxxxxxxxxx
```

Generate new keys with:
```bash
npm run generate-key [name] [scope] [rate_limit]
```

## Testing

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm run test:coverage # Coverage report
```

Tests use in-memory SQLite (`:memory:`) so no cleanup needed.

## Important Files

- `src/config.ts` - All environment variable handling
- `src/db/client.ts` - Database initialization and migrations
- `src/security/api-keys.ts` - Key generation and verification
- `src/middleware/auth.ts` - Request authentication

## Gotchas

1. **Vault sync is optional** - If `OBSIDIAN_VAULT_PATH` is not set or doesn't exist, vault sync silently skips.

2. **API keys are shown only once** - On generation, the raw key is displayed. After that, only the hash is stored.

3. **Task IDs are formatted** - Tasks use `PROJECT-NNN` format (e.g., `OADS-001`), not random IDs like other entities.

4. **Tags are stored as JSON** - In the database, tags are a JSON string. Parse with `JSON.parse()`.
