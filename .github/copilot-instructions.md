# Copilot Instructions — ffs-squad-monitor

## Project Overview

**ffs-squad-monitor** is a real-time monitoring dashboard for First Frame Studios' AI squad operations. It provides live visibility into agent activity, heartbeats, structured logs, and token usage by reading outputs from the FFS hub repo's `ralph-watch.ps1` scheduler loop.

This is a **read-only observer** — it doesn't control agents, just displays their state.

## Tech Stack

- **Vite** — fast dev server and build tool
- **Vanilla JavaScript** — minimal dependencies, component-based architecture
- **CSS** — custom styling (no framework)
- **Vite plugin middleware** — custom API endpoints for backend data
- **`gh` CLI** — GitHub API integration for fetching squad data
- **Default branch:** `master` (NOT `main`)

## File Structure

```
ffs-squad-monitor/
├── src/
│   ├── monitor.js         # Main entry point
│   ├── components/        # UI components (widgets, panels, cards)
│   ├── lib/
│   │   ├── api.js        # Client-side API calls to backend
│   │   ├── scheduler.js  # Polling scheduler for live updates
│   │   └── util.js       # Utility functions
│   ├── index.html        # Main HTML template
│   └── styles.css        # Global styles
├── vite.config.js        # Vite config with middleware for API endpoints
├── package.json
└── .squad/               # Squad AI workflow
```

## Key Architecture

### Components (src/components/)
Reusable UI components that render specific dashboard widgets:
- Heartbeat monitor widget
- Agent activity log panel
- Round statistics panel
- Dashboard layout and navigation

Each component is a JavaScript module that returns DOM elements or renders to a target container.

### API Layer (src/lib/api.js)
Client-side API calls to backend endpoints provided by Vite middleware:
- Fetch heartbeat status
- Tail structured logs
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

**Minimal dependencies:** Keep it simple — vanilla JS, no React/Vue/Svelte. Easy to read, extend, debug.

**Component-based:** Modular UI components that compose into dashboard. Single responsibility per component.

**Polling over WebSockets:** Simple scheduler that polls backend at intervals. No WebSocket complexity for MVP.

**Read-only observer:** No control plane — just visualizes FFS squad state.

## Squad Workflow

### Issue Lifecycle
1. Issues start in Squad triage inbox (label: `squad`)
2. Lead assigns to member via `squad:{agent}` label (ripley, dallas, lambert, kane)
3. Agent self-assigns and creates branch: `squad/{issue-number}-{slug}`
4. Agent opens PR with "Closes #{issue-number}" in body
5. PR reviewed and merged to `master` → issue auto-closes

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
- Target branch: `master`

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
