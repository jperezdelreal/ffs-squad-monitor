# ffs-squad-monitor

Real-time monitoring dashboard for [First Frame Studios](https://github.com/jperezdelreal/FirstFrameStudios) AI squad operations.

## Inspiration

Inspired by [Tamir Dresher's squad-monitor](https://github.com/tamirdresher/squad-monitor) — the idea of a live dashboard that shows what agents are doing in real time, tracking heartbeats, structured logs, agent activity, and token usage.

## What it does

This dashboard connects to the FFS squad infrastructure and provides:

- **Heartbeat Monitor** — reads `tools/.ralph-heartbeat.json` written by `ralph-watch.ps1` and displays agent status (idle, running, error) with live updates
- **Agent Activity Log** — tails structured logs from `tools/logs/` and renders them in a filterable, searchable view
- **Round Statistics** — tracks scheduler rounds, durations, and outcomes over time
- **Dashboard UI** — lightweight web interface for at-a-glance squad health

## How it relates to FFS

The FFS repo (`FirstFrameStudios`) runs an autonomous agent loop via `ralph-watch.ps1`. That script writes a heartbeat file and structured logs every cycle. This monitor repo reads those outputs and presents them visually — it's a read-only observer of the squad's activity.

## Tech Stack

- **Vite** — fast dev server and build tool
- **React** — component-based UI with hooks and Tailwind CSS
- **Node.js** — for the heartbeat file watcher and log tailer backend

## Getting Started

**Development mode (with backend proxy):**

```bash
# Terminal 1 — Start the backend API server
npm run server

# Terminal 2 — Start the Vite dev server
npm run dev
```

Then open `http://localhost:5173` in your browser. The Vite dev server proxies `/api` requests to the backend server running on port 3001.

**Production mode:**

```bash
npm run build
npm run preview
```

**Running backend independently:**

The backend API server can run standalone without Vite:

```bash
npm run server
# Server starts on http://localhost:3001
```

Available API endpoints:
- `GET /api/heartbeat` — Ralph heartbeat status
- `GET /api/logs/files` — Available log files
- `GET /api/logs/stream` — SSE stream of new log entries
- `GET /api/logs` — Structured logs (supports ?date and ?agent params)
- `GET /api/timeline` — Timeline view of rounds
- `GET /api/issues` — Cross-repo issue board
- `GET /api/pulse` — Studio pulse stats
- `GET /api/agents` — Agent roster and status
- `GET /api/repos` — Repository status
- `GET /health` — Health check

## Deployment

For production deployment options and instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The dashboard includes a health check endpoint at `GET /api/health` for monitoring.

## Testing

**Running tests:**

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

The test suite uses [Vitest](https://vitest.dev) and achieves 97%+ coverage on core library modules (util, scheduler, api).

**Running tests:**

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

The test suite uses [Vitest](https://vitest.dev) and achieves 97%+ coverage on core library modules (util, scheduler, api).

## Configuration

Set environment variables to configure the dashboard:

```bash
# GitHub API authentication (recommended — raises rate limit from 60 to 5,000 req/hr)
# Option 1: Set the token directly
GITHUB_TOKEN=ghp_your_token_here

# Option 2: If gh CLI is authenticated, the server auto-detects the token via `gh auth token`

# FFS paths (defaults shown)
FFS_HEARTBEAT_PATH=../FirstFrameStudios/tools/.ralph-heartbeat.json
FFS_ROOT=../FirstFrameStudios

# Server port (default: 3001)
PORT=3001
```

### GitHub Token

The backend makes GitHub API calls to fetch issues, PRs, and repo status. Without a token, GitHub's anonymous rate limit of **60 requests/hour** applies and will quickly be exhausted.

**Setting up a token:**
1. Create a [fine-grained personal access token](https://github.com/settings/tokens?type=beta) with read-only access to your repositories
2. Set it as `GITHUB_TOKEN` in your environment or `.env` file
3. Alternatively, if you have `gh` CLI authenticated (`gh auth login`), the server will automatically use its token

The token is **never exposed to the frontend** — all GitHub API calls go through the backend. The `/health` endpoint shows rate limit status without revealing the token.

## Status

🚧 **Sprint 0** — Project scaffolding. Core features are planned but not yet implemented.

## License

MIT
