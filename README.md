# Mythril Core

Backend API server for Mythril. Handles persistent storage, notes, tasks, and brain functionality.

## Part of Mythril

This is the API server component. You probably want [mythril-bot](https://github.com/Zarosk/mythril-bot) for the full setup.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/v1/notes | Create note |
| GET | /api/v1/notes | List notes |
| POST | /api/v1/tasks | Create task |
| GET | /api/v1/tasks | List tasks |
| POST | /api/v1/feedback | Submit feedback |

## Running Standalone

```bash
cp .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:3000`

## Links

- [Main Bot](https://github.com/Zarosk/mythril-bot)
- [Discord Community](https://discord.gg/5DhmG2uvBp)

## License

MIT
