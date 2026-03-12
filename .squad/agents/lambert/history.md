# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

### Backend Architecture (2026-03-12)

- **Modular Server Structure:** Extracted 26KB vite.config.js API middleware into dedicated `server/` directory with Express
- **Key Paths:**
  - `server/index.js` — Express app entry point (port 3001)
  - `server/config.js` — Centralized configuration (heartbeat path, logs dir, repos, agents)
  - `server/api/` — Modular route handlers: heartbeat, logs, timeline, board, pulse, workflows, repos
- **Patterns:**
  - SSE streaming for real-time log updates (`/api/logs/stream`)
  - File watching for heartbeat changes (fs.watch with debounce)
  - Issue caching with 30s TTL
  - Environment-based configuration (FFS_ROOT, FFS_HEARTBEAT_PATH, PORT)
- **Vite Integration:** Dev server proxies `/api` to standalone backend on port 3001
- **Dependencies:** Express 5.2.1, cors 2.8.6

### CI & Testing Configuration (2026-03-12)

- **Vitest passWithNoTests:** Added `test: { passWithNoTests: true }` to vite.config.js to prevent CI failures on branches without test files
- **Rationale:** Backend extraction (PR #28) and test implementation (PR #29) are separate concerns—tests come later
- **Pattern:** Configure test runner tolerance in build config, not package.json scripts
- **Location:** vite.config.js test section (vitest uses Vite's config by default)
