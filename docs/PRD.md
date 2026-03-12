# Product Requirements Document: ffs-squad-monitor

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2025-01-19

## Overview

ffs-squad-monitor is a real-time monitoring dashboard for First Frame Studios AI squad operations. It provides visibility into the health, activity, and performance of autonomous agents working across the FFS ecosystem.

The dashboard is a **read-only observer** — it connects to the FFS squad infrastructure, reads heartbeat files and structured logs, and presents them in a visual interface. It does not control or modify agent behavior.

## Inspiration

This project was inspired by [Tamir Dresher's squad-monitor](https://github.com/tamirdresher/squad-monitor), which demonstrated the value of real-time agent visibility for LLM-powered autonomous systems.

## Problem Statement

FFS runs autonomous agents via `ralph-watch.ps1` in the FirstFrameStudios repo. These agents work independently, processing issues, making commits, and managing work across multiple repositories. Without visibility into agent activity:

- **Debugging is difficult** — when agents fail or behave unexpectedly, there's no easy way to see what happened
- **Performance is opaque** — it's unclear how long rounds take, which agents are active, or whether the system is healthy
- **Monitoring requires manual inspection** — checking heartbeat files and log files by hand is tedious
- **Cross-repo awareness is missing** — agents work across multiple repos, but there's no unified view of squad activity

ffs-squad-monitor solves this by providing a **mission control dashboard** for the FFS squad.

## Core Features (Implemented in Sprint 0)

### 1. Heartbeat Monitor
- Reads `tools/.ralph-heartbeat.json` from the FirstFrameStudios repo
- Displays agent status: idle, running, error, offline
- Shows last activity timestamp
- Auto-refreshes via polling

**API:** `GET /api/heartbeat`

### 2. Agent Activity Log
- Tails structured JSONL logs from `tools/logs/`
- Filters by agent, log level, and date
- Server-sent events (SSE) for real-time streaming
- Searchable and filterable UI

**API:** `GET /api/logs` (SSE stream)

### 3. Agent Activity Timeline
- Swim-lane visualization showing each agent's rounds over time
- Color-coded by status (success, error, running)
- Timeline filter: show last 10/20/30/50/All rounds
- Hover tooltips with duration and outcome

**API:** `GET /api/timeline`

### 4. Cross-Repo Issue Board
- Aggregates open issues across all FFS repos
- Groups by repo with emoji icons
- Shows issue number, title, labels, assignee
- Links directly to GitHub

**API:** `GET /api/board`

### 5. Studio Pulse
- Real-time stats: PRs merged, issues closed, active agents
- Shows squad health at a glance
- Updates every 30 seconds

**API:** `GET /api/pulse`

### 6. GitHub Actions Status
- Workflow status badges per repo
- Shows latest CI/CD runs
- Indicates build health

**API:** `GET /api/workflows`

### 7. Dashboard UI
- Dark sci-fi "mission control" theme inspired by Alien (1979)
- Responsive layout (grid-based)
- Component-based architecture (vanilla JS modules)
- Real data integration (no mock data)
- Connection status indicator
- Settings panel for configuration

## Technical Architecture

### Tech Stack
- **Frontend:** Vanilla JavaScript (ES modules), CSS (custom dark theme)
- **Dev Server & Build:** Vite
- **Backend:** Node.js middleware (embedded in `vite.config.js`)
- **Data Sources:** JSON files, JSONL logs, GitHub API
- **Deployment:** Static site (Vite build output) + Node.js server

### Current Structure
```
package.json          — Vite config, dependencies
vite.config.js        — 26KB file containing ALL backend API middleware
src/
  index.html          — Dashboard layout
  monitor.js          — Entry point, scheduler initialization
  styles.css          — 25KB dark theme
  components/         — UI components (10 modules)
  lib/                — Core utilities (api.js, scheduler.js, util.js)
```

### API Middleware (in vite.config.js)
All backend logic is currently embedded in `vite.config.js` as Vite middleware:
- `/api/heartbeat` — reads ralph-heartbeat.json
- `/api/logs` — SSE stream of structured logs
- `/api/timeline` — agent activity timeline data
- `/api/agents` — agent roster and metadata
- `/api/board` — cross-repo issue aggregation
- `/api/pulse` — studio statistics
- `/api/workflows` — GitHub Actions status

### Data Flow
1. **Heartbeat:** Ralph writes `.ralph-heartbeat.json` → Monitor reads via `/api/heartbeat`
2. **Logs:** Agents write JSONL logs → Monitor tails via `/api/logs` (SSE)
3. **Issues:** GitHub API → Monitor aggregates via `/api/board`
4. **Workflows:** GitHub API → Monitor fetches via `/api/workflows`

## Sprint Roadmap

### Sprint 1: Backend Extraction & Testing Foundation
**Focus:** Extract backend from vite.config.js, add error handling, establish testing

### Sprint 2: Deployment & Production Readiness
**Focus:** Deploy to GitHub Pages or similar, add offline resilience, improve reconnection logic

### Sprint 3: UX Polish & Advanced Features
**Focus:** Improve UI/UX, add advanced filters, enhance timeline visualization

### Sprint 4: Performance & Observability (optional)
**Focus:** Optimize polling, add performance metrics, dashboard analytics

## Non-Goals

- **Agent control** — This dashboard is read-only. It does not start, stop, or control agents.
- **Authentication** — Currently designed for local/internal use. No auth required.
- **Historical analysis** — Focus is on real-time monitoring, not long-term analytics
- **Multi-user collaboration** — Single-user dashboard for the FFS operator

## Success Metrics

- **Visibility:** All agent activity is visible in real-time
- **Performance:** Dashboard loads in <2s, updates in <1s
- **Reliability:** Dashboard handles agent failures gracefully
- **Usability:** Operator can diagnose agent issues in <30s

## Dependencies

- **FirstFrameStudios repo** — must be cloned locally at `../FirstFrameStudios`
- **Ralph heartbeat** — `ralph-watch.ps1` must be running to write heartbeat
- **Structured logs** — agents must write JSONL logs to `tools/logs/`
- **GitHub API** — requires network access to fetch issues and workflows

## Team Roster (Alien 1979 Universe)

| Name    | Role         | Responsibilities                     |
|---------|--------------|--------------------------------------|
| Ripley  | Lead         | Architecture, planning, coordination |
| Dallas  | Frontend Dev | UI components, styles, UX            |
| Lambert | Backend Dev  | API middleware, data integration     |
| Kane    | Tester       | Testing, quality assurance           |

## Future Considerations

- **WebSocket support** — replace polling with persistent connections
- **Log search** — full-text search across historical logs
- **Alerting** — notifications when agents fail or stall
- **Mobile view** — responsive design for phone/tablet
- **Token usage tracking** — monitor LLM API costs
- **Multi-repo agents** — better visualization of agents working across repos

## References

- [Tamir Dresher's squad-monitor](https://github.com/tamirdresher/squad-monitor)
- [First Frame Studios](https://github.com/jperezdelreal/FirstFrameStudios)
- [Ralph scheduler documentation](https://github.com/jperezdelreal/FirstFrameStudios/blob/main/tools/README.md)
