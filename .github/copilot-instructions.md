# Copilot Instructions — ffs-squad-monitor

## Project Overview

**ffs-squad-monitor** is a real-time monitoring dashboard for First Frame Studios' AI squad operations. It provides live visibility into agent activity, heartbeats, structured logs, and token usage by reading outputs from the FFS hub repo's `ralph-watch.ps1` scheduler loop.

This is a **read-only observer** — it doesn't control agents, just displays their state.

## Tech Stack

- **React** — component-based UI with JSX
- **Vite** — fast dev server and build tool
- **Tailwind CSS** — utility-first styling framework
- **Zustand** — lightweight state management
- **Express** — backend API server (port 3001)
- **`gh` CLI** — GitHub API integration for fetching squad data
- **Default branch:** `main`

## File Structure

```
ffs-squad-monitor/
├── src/
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Root React component
│   ├── components/        # React components (all .jsx files)
│   ├── hooks/             # Custom React hooks (useMetrics, useSSE, usePolling)
│   ├── lib/               # Core utilities (api, health, notifications, scheduler)
│   ├── services/          # Backend services (github.js, config.js, mockData.js)
│   ├── store/             # Zustand state management
│   └── index.css          # Tailwind CSS imports
├── server/                # Express backend (port 3001)
│   ├── index.js           # API routes
│   └── lib/               # Backend utilities (metrics-db.js)
├── index.html             # Root HTML template
├── vite.config.js         # Vite config
├── package.json
└── .squad/                # Squad AI workflow
```

## Key Architecture

### Components (src/components/)
React components that render dashboard widgets:
- **Header.jsx** — Connection status, heartbeat, staleness alerts
- **ActivityFeed.jsx** — Real-time agent activity stream
- **PipelineVisualizer.jsx** — Task pipeline visualization
- **TeamBoard.jsx** — Cross-repo team status
- **CostTracker.jsx** — Token usage and cost metrics
- **Analytics.jsx** — Dashboard analytics and trends
- Plus: Sidebar, Settings, ErrorBoundary, and utility components

### API Layer (src/lib/api.js)
Client-side API calls to Express backend (port 3001):
- Fetch metrics, heartbeat status, logs
- Server-Sent Events (SSE) for real-time updates
- Retrieve round statistics
- Query GitHub data via `gh` CLI

### Scheduler (src/lib/scheduler.js)
Polling system that periodically fetches updates from backend and refreshes UI. Configurable intervals, cancellable, error handling.

### Backend (vite.config.js middleware)
Custom Vite plugin middleware that:
- Reads `../FirstFrameStudios/tools/.ralph-heartbeat.json`
- Tails `../FirstFrameStudios/tools/logs/*.json`
- Wraps `gh` CLI commands for GitHub API data
- Exposes REST-like endpoints for frontend

### Heartbeat Monitor
Reads `.ralph-heartbeat.json` written by FFS's `ralph-watch.ps1` and displays:
- Agent status (idle, running, error)
- Last heartbeat timestamp
- Current round number
- Active agent/task

### Agent Activity Log
Tails structured logs from `tools/logs/` and renders:
- Chronological activity stream
- Filterable by agent, log level, or keyword
- Search functionality

### Round Statistics
Tracks scheduler rounds:
- Round duration
- Success/failure counts
- Average cycle time
- Historical trends

## Design Philosophy

**React-based architecture:** Component-based UI with JSX, modern React patterns (hooks, state management with Zustand), Tailwind CSS for styling.

**Component-based:** Modular React components that compose into dashboard. Single responsibility per component. Well-tested with Vitest.

**SSE + Polling:** Server-Sent Events for real-time updates, polling fallback for reliability. Express backend on port 3001.

**Read-only observer:** No control plane — just visualizes FFS squad state.

## Squad Workflow

### Issue Lifecycle
1. Issues start in Squad triage inbox (label: `squad`)
2. Lead assigns to member via `squad:{agent}` label (ripley, dallas, lambert, kane)
3. Agent self-assigns and creates branch: `squad/{issue-number}-{slug}`
4. Agent opens PR with "Closes #{issue-number}" in body
5. PR reviewed and merged to `main` → issue auto-closes

### Team

| Agent   | Role         | Domain                      |
|---------|--------------|----------------------------|
| Ripley  | Lead         | Architecture, planning     |
| Dallas  | Frontend Dev | UI, components, styling    |
| Lambert | Backend Dev  | Vite middleware, API, `gh` |
| Kane    | Tester       | QA, testing, bug fixes     |
| Scribe  | Scribe       | Documentation              |
| Ralph   | Monitor      | Heartbeat automation       |

### Branch Naming
- Format: `squad/{issue-number}-{slug}`
- Example: `squad/12-add-heartbeat-widget`

### PR Requirements
- Must include "Closes #{issue-number}" in body
- Must pass review by Lead or designated reviewer
- Code must follow existing patterns (modular components, minimal deps)
- Target branch: `main`

### Labels
- `squad` — triage inbox
- `squad:{agent}` — assigned to agent (ripley, dallas, lambert, kane)
- `go:yes` / `go:no` / `go:needs-research` — triage verdict
- `type:feature` / `type:bug` / `type:spike` / `type:docs` / `type:chore` / `type:epic`
- `priority:P0` / `priority:P1` / `priority:P2` / `priority:P3`
- `release:v0.x.x` / `release:backlog`
- `blocked-by:{type}` — blockers
- `bug` / `feedback` — high-signal labels

## Coding Conventions

- Use ES6+ features (const/let, arrow functions, modules, async/await)
- No semicolons (optional, follow existing style)
- 2-space indentation
- Component modules export single function or object
- Keep functions small and focused
- Descriptive names (`fetchHeartbeat`, `renderActivityLog`, not `f`, `r`)
- Comments only where clarification needed

## Development Workflow

### Local Development
```bash
npm install
npm run dev
```
Runs Vite dev server on `http://localhost:5173`

### Build
```bash
npm run build
```
Outputs to `dist/`

### Configuration
Set path to FFS heartbeat file:
```bash
FFS_HEARTBEAT_PATH=../FirstFrameStudios/tools/.ralph-heartbeat.json
```

## Testing

Manual testing via browser. No unit test framework yet. Test by running dev server and verifying widgets render correctly.

## Inspiration

Based on [Tamir Dresher's squad-monitor](https://github.com/tamirdresher/squad-monitor) — live dashboard for agent activity, heartbeats, logs, and token usage.

## References

- FFS Hub: [FirstFrameStudios repo](https://github.com/jperezdelreal/FirstFrameStudios)
- Vite: [vitejs.dev](https://vitejs.dev)
- Universe: Alien (1979)


## ⚠️ CRITICAL: Protected Files — NEVER Delete

The following files are essential Squad infrastructure. NEVER delete, move, or rename them under any circumstances. If a task seems to require removing these files, STOP and ask for guidance.

- .github/agents/squad.agent.md — Squad coordinator governance (session fails without this)
- .squad/team.md — Team roster (workflows break without this)
- .squad/ceremonies.md — Ceremony definitions
- .squad/routing.md — Agent routing rules
- .squad/agents/*/charter.md — Agent identity files