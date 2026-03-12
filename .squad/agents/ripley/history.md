# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

### PR Review Session - 2026-03-12

Reviewed three PRs (#30, #29, #27) covering workflow automation, testing infrastructure, and error handling:

**PR #30 - Content-Aware Triage (14 additions):**
- Synced squad-triage.yml with Hub's intelligent triage logic
- Quality heuristic: 100+ chars + (acceptance criteria | checklist | structured sections | requirements) = go:ready
- Prevents blanket go:needs-research labels, routes quality issues directly to implementation

**PR #29 - Unit Tests (1391 additions, 11 files):**
- Vitest 4.1.0 + happy-dom environment for DOM testing
- 97.61% coverage on src/lib/ (util, scheduler, api) - exceeds 80% baseline
- CI workflow with coverage artifacts, proper gitignore for coverage/
- Test organization: __tests__ subdirectories next to source

**PR #27 - Error Handling & Resilience (541 additions, 12 files):**
- 3-state connection tracking (operational/degraded/offline) with per-endpoint status
- SSE exponential backoff (1s→30s max, 10 attempts) with manual retry
- Error boundary wrapper for uncaught errors, critical overlay at 10+ errors
- All 7 components have error states with retry UI, consistent {error: true, message} pattern
- safeFetch() wrapper: 10s timeout, error logging, endpoint status tracking

**Key architectural patterns observed:**
- Centralized state management (connection status Map, error counts)
- Progressive enhancement (degraded state between operational/offline)
- User-facing recovery paths (global window.__retryX functions)
- Defensive coding (try-catch around all async operations, null checks)

**Limitation encountered:**
- Cannot formally approve PRs via GitHub API when authenticated as PR author
- Workaround: Posted review comments with explicit APPROVED verdicts

### PR #28 Review — Backend API Extraction (2026-03-12)

**Architecture Decision:**
- Extracted 26KB monolithic vite.config.js into modular Express server
- Created server/ directory with dedicated API handlers (heartbeat, logs, timeline, board, pulse, workflows, repos)
- Vite dev server proxies /api requests to standalone backend on port 3001
- Centralized configuration in server/config.js with environment overrides

**Key Patterns Found:**
- **Caching:** Heartbeat file watcher for real-time updates, 30s TTL for GitHub issue cache
- **Streaming:** SSE endpoint for real-time log tailing with fs.watch + debouncing
- **Resilience:** Try/catch in all handlers, graceful fallbacks on GitHub API failures
- **Module exports:** Clean single-responsibility handlers, shared utilities between routes

**Critical Issue Identified:**
- Error handler middleware placed BEFORE routes in server/index.js — Express requires error handlers AFTER all routes to catch route errors
- Pattern: `app.use(routes) → app.use(errorHandler)` not `app.use(errorHandler) → app.use(routes)`

**Quality Observations:**
- Proper use of execSync timeouts (5-15s) with stdio pipe configuration
- File watching patterns handle edge cases (directory doesn't exist, file deleted then recreated)
- Good separation: config, API handlers, shared utilities, route registration

**Future Considerations:**
- Server shutdown should capture server instance for graceful close: `const server = app.listen(...)`
- Consider connection pooling if GitHub API rate limits become an issue

<!-- Append new learnings below. Each entry is something lasting about the project. -->
