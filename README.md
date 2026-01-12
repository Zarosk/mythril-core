# Mythril Core

Backend API server for Mythril. Handles persistent storage, notes, tasks, and brain functionality.

## Part of Mythril

This is the API component. See [mythril-bot](https://github.com/Zarosk/mythril-bot) for the full system.

## Architecture

```
iPhone ───────► HTTP API ──┐
Discord ──────► HTTP API ──┼──► SQLite DB ──► Obsidian Vault
Browser ──────► HTTP API ──┘         │
                                     └──► Claude Desktop reads via MCP
```

## Quick Start

```bash
git clone https://github.com/Zarosk/mythril-core.git
cd mythril-core
cp .env.example .env
npm install
npm run dev
```

Server runs on http://localhost:3000

## API Endpoints

All endpoints except `/health` require `X-API-Key` header.

### Notes
```bash
POST /api/v1/notes          # Create a note
GET  /api/v1/notes          # List notes
GET  /api/v1/notes/:id      # Get a note
DELETE /api/v1/notes/:id    # Delete a note
```

### Artifacts
```bash
POST /api/v1/artifacts      # Create artifact
GET  /api/v1/artifacts      # List artifacts
GET  /api/v1/artifacts/:id  # Get artifact
DELETE /api/v1/artifacts/:id
```

### Tasks
```bash
POST /api/v1/tasks          # Create task
GET  /api/v1/tasks          # List tasks
POST /api/v1/tasks/:id/activate
POST /api/v1/tasks/:id/complete
```

### Search
```bash
GET /api/v1/search?q=keyword
```

## Tech Stack

- Node.js 20+ / TypeScript
- Fastify HTTP server
- SQLite (better-sqlite3)
- Zod validation
- bcrypt API key hashing

## Links

- [Main Bot](https://github.com/Zarosk/mythril-bot)
- [Documentation](https://mythril-docs.vercel.app)

## License

MIT
