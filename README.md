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
- **Vanilla JS** — minimal dependencies, easy to learn and extend
- **Node.js** — for the heartbeat file watcher and log tailer backend

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

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

## Configuration

Set the path to your FFS repo heartbeat file:

```bash
# Default: looks for ../FirstFrameStudios/tools/.ralph-heartbeat.json
FFS_HEARTBEAT_PATH=../FirstFrameStudios/tools/.ralph-heartbeat.json
```

## Status

🚧 **Sprint 0** — Project scaffolding. Core features are planned but not yet implemented.

## License

MIT
