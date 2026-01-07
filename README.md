# Mythril Core API

HTTP API server for cross-platform note/idea capture. This is the bridge that lets iPhone, web browser, and Discord push content into the Mythril system.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   iPhone ───────► HTTP API ──┐                                              │
│   Discord ──────► HTTP API ──┼──► SQLite DB ──► Obsidian Vault             │
│   Browser ──────► HTTP API ──┘         │                                    │
│                                        │                                    │
│                                        └──► Claude Desktop reads via MCP   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode)
- **HTTP Server:** Fastify
- **Database:** SQLite (better-sqlite3)
- **Validation:** Zod
- **Auth:** API Keys (bcrypt hashed)
- **Testing:** Vitest

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your settings
# - Set OBSIDIAN_VAULT_PATH to your vault location
# - Set a unique API_KEY_SALT

# Start development server
npm run dev

# The server will generate an initial API key on first run - save it!
```

## API Endpoints

### Authentication
All endpoints except `/health` require the header:
```
X-API-Key: oads_live_xxxxxxxxxxxx
```

### Health Check
```bash
GET /health
# Response: { "status": "ok", "version": "1.0.0" }
```

### Notes
```bash
# Create a note
POST /api/v1/notes
Body: { "content": "string", "project?": "string", "tags?": ["string"] }

# List notes
GET /api/v1/notes?project=xxx&limit=20&offset=0&search=xxx

# Get a note
GET /api/v1/notes/:id

# Delete a note
DELETE /api/v1/notes/:id
```

### Artifacts
```bash
# Create an artifact
POST /api/v1/artifacts
Body: {
  "title": "string",
  "content": "string",
  "content_type": "code|markdown|json",
  "language?": "typescript",
  "project?": "string"
}

# List/Get/Update/Delete
GET /api/v1/artifacts
GET /api/v1/artifacts/:id
PUT /api/v1/artifacts/:id
DELETE /api/v1/artifacts/:id
```

### Context
```bash
# Get project context (includes recent notes/artifacts)
GET /api/v1/context/:project

# Update project context
PUT /api/v1/context/:project
Body: { "summary": "...", "tech_stack": [...] }
```

### Tasks
```bash
# Create a task
POST /api/v1/tasks
Body: {
  "title": "string",
  "description": "string",
  "project": "string",
  "trust_level?": "THROWAWAY|PROTOTYPE|MATURE"
}

# List/Get tasks
GET /api/v1/tasks
GET /api/v1/tasks/:id

# Activate a task
POST /api/v1/tasks/:id/activate

# Complete/Cancel/Delete
POST /api/v1/tasks/:id/complete
POST /api/v1/tasks/:id/cancel
DELETE /api/v1/tasks/:id
```

### Search
```bash
GET /api/v1/search?q=keyword&types=notes,artifacts
```

## Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Run production build
npm run lint         # Run ESLint
npm run test         # Run tests
npm run generate-key # Generate a new API key
```

## iOS Shortcut Setup

Create an iOS Shortcut to quickly capture notes:

1. **Open Shortcuts app** → Create new shortcut
2. **Add actions:**
   - Receive [Text, URLs] from Share Sheet
   - Ask for Input (prompt: "Project? (optional)")
   - Get Contents of URL:
     - URL: `https://your-server/api/v1/notes`
     - Method: POST
     - Headers: `X-API-Key: your_key`, `Content-Type: application/json`
     - Body: `{"content": "[Shortcut Input]", "project": "[Asked Input]", "source": "ios-shortcut"}`
   - Show Notification: "Added to Brain"
3. **Enable "Show in Share Sheet"**
4. **Name it "Add to Brain"**

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| HOST | Server host | 0.0.0.0 |
| NODE_ENV | Environment | development |
| DATABASE_PATH | SQLite database path | ./data/brain.db |
| OBSIDIAN_VAULT_PATH | Path to Obsidian vault | (required for sync) |
| API_KEY_SALT | Salt for API key hashing | (required in production) |

## Security

- All API routes require authentication via `X-API-Key` header
- API keys are bcrypt-hashed before storage
- Rate limiting: 100 requests/minute per key (configurable)
- Input validation via Zod schemas
- Audit logging of all API requests
- XSS and SQL injection prevention

## Project Structure

```
oads-brain/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment config
│   ├── app.ts                # Fastify app setup
│   ├── routes/               # API route handlers
│   ├── middleware/           # Auth, rate-limit, validation
│   ├── services/             # Business logic
│   ├── db/                   # Database client & migrations
│   ├── security/             # API keys, audit, sanitization
│   └── types/                # TypeScript types
├── tests/                    # Test files
├── data/                     # SQLite database (gitignored)
└── ...
```

## License

MIT
