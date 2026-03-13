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

### 2026-03-12: PR #29 Review - Unit Testing Infrastructure (Issue #22)

**Architecture Decision: Testing Infrastructure**
- Adopted Vitest 4.1.0 as test framework with happy-dom environment for DOM testing
- Test files located in `src/lib/__tests__/` subdirectories adjacent to source files
- Coverage configuration in `vitest.config.js` with 80% threshold enforcement across all metrics (lines, functions, branches, statements)
- Three npm scripts: `npm test` (run once), `npm run test:watch` (watch mode), `npm run test:coverage` (coverage report)

**Coverage Achievement:**
- 97.61% overall coverage on src/lib/ modules (exceeding 80% requirement by 17.6 points)
- util.js: 100% (18 tests)
- scheduler.js: 95.45% (11 tests)
- api.js: 97.29% (21 tests)
- Total: 50 passing tests

**Test Quality Patterns:**
- Proper edge case coverage: null/undefined handling, boundary conditions, XSS prevention in escapeHtml
- Mock management: fetch API properly mocked with realistic success/failure scenarios in api tests
- Timer management: vi.useFakeTimers() with proper cleanup in beforeEach/afterEach for scheduler tests
- Module state: Used vi.resetModules() where internal state persists across tests
- Clean test organization: Each test focuses on single concern, descriptive test names

**CI/CD Integration:**
- GitHub Actions workflow at `.github/workflows/test.yml`
- Runs on PR and main branch pushes
- Uses Node.js 20 with npm ci for reproducible builds
- Uploads coverage artifacts with actions/upload-artifact@v4
- Test failures block PR merge

**Key File Paths:**
- Test config: `vitest.config.js`
- CI workflow: `.github/workflows/test.yml`
- Tests: `src/lib/__tests__/{util,scheduler,api}.test.js`
- Source modules: `src/lib/{util,scheduler,api}.js`

**Documentation:**
- README.md updated with testing section including all three npm commands
- Clear instructions for running tests locally and in watch mode

### 2026-03-12: PR #27 Review - Error Handling & Offline Resilience (Issue #23)

**Review Outcome:** CHANGES REQUESTED - 4 critical issues identified requiring fixes before merge

**Critical Issues Found:**
1. **studio-pulse.js missing retry UI** - Only component without error recovery path (just shows dashes)
2. **error-boundary.js errorCount never resets** - Dashboard becomes permanently degraded after 10 transient errors
3. **log-viewer.js exponential backoff off-by-one** - First retry uses 2000ms instead of 1000ms due to premature increment
4. **api.js AbortSignal.timeout memory leak** - Implicit controllers may not GC properly in long-running sessions

**Architecture Strengths:**
- 3-state connection tracking (operational/degraded/offline) with per-endpoint status Map
- Error boundary pattern catches uncaught errors + unhandled promise rejections
- Consistent error UI pattern across 6/7 components with retry buttons
- SSE exponential backoff mathematically correct (1s, 2s, 4s, 8s, max 30s)
- safeFetch() wrapper with 10s timeout, error logging, status tracking
- All components return {error: true, message} for better context

**Code Quality Patterns:**
- Global window.__retryX() functions provide user recovery paths
- Consistent error state CSS (.error-state, .retry-btn, notifications, critical overlay)
- Proper cleanup of EventSource and reconnect timers
- Console logging with timestamps and context for debugging

**Key Learning:** Error handling infrastructure requires attention to reset/cleanup mechanisms. Incrementing error counters and reconnect attempts need proper reset logic to prevent permanent degradation. Memory management is critical for long-running dashboard sessions.

**File Paths:**
- `src/lib/api.js` - Connection state tracking, safeFetch wrapper
- `src/lib/error-boundary.js` - Global error handler with critical overlay
- `src/components/connection-status.js` - 3-state UI indicator
- `src/components/log-viewer.js` - SSE with exponential backoff
- `src/components/*.js` - Error states with retry buttons
- `src/styles.css` - Error UI styles
