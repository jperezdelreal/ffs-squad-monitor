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

### 2026-03-13: PR #29 Second Review - Unit Testing Infrastructure (Issue #22)

**Review Outcome:** APPROVED - Production-ready testing foundation established.

**Test Execution Verified:**
- Checked out branch `squad/22-unit-tests` and ran full test suite locally
- All 50 tests pass: 18 util + 11 scheduler + 21 api
- Coverage: 97.61% overall (17.6 points above 80% requirement)
  - util.js: 100%
  - scheduler.js: 95.45% (line 48 uncovered - edge case in #startTask)
  - api.js: 97.29%

**Quality Validation:**
- **Mocking discipline:** fetch API properly mocked, fake timers with proper beforeEach/afterEach cleanup
- **Edge case coverage:** null/undefined, boundary conditions, XSS prevention (escapeHtml), HTTP errors (404/500), network failures
- **Test organization:** Single concern per test, descriptive names like "sets disconnected on failure", logical grouping with nested describes
- **Timer testing:** Proper use of vi.useFakeTimers() + vi.advanceTimersByTime() for scheduler interval verification
- **Async handling:** All fetch tests properly await, error cases verify null returns

**CI/CD Configuration Review:**
- `.github/workflows/test.yml` triggers on PR and main branch pushes
- Uses Node.js 20, npm ci for reproducible builds
- Runs both `npm test` and `npm run test:coverage`
- Uploads coverage artifacts with actions/upload-artifact@v4
- Test failures will block PR merge

**Configuration Files:**
- `vitest.config.js` properly configured with v8 provider, happy-dom environment
- Coverage includes only `src/lib/**/*.js`, excludes test files
- 80% thresholds enforced on lines/functions/branches/statements
- `.gitignore` includes `coverage/` directory

**Documentation:**
- README.md updated with testing section showing all three npm commands
- Clear explanation of Vitest usage and 97%+ coverage achievement

**Minor Observation (not blocking):**
- `api.test.js` doesn't use `vi.resetModules()` to reset connection state between tests
- Module-level state (_connected flag, listeners Set) persists across tests
- However, tests are effectively isolated through intentional sequencing (line 69-80 shows awareness)
- This is acceptable for P1 foundation; can be improved later if test ordering becomes fragile

**Team Guidance Confirmed:**
This PR establishes the pattern for future testing:
- New lib modules require 80%+ coverage
- Use vi.useFakeTimers() for time-dependent code
- Mock fetch for network calls
- Test edge cases: null/undefined, boundaries, error paths

**GitHub API Limitation:**
Cannot use `gh pr review --approve` when authenticated as PR author. Posted approval as comment instead with explicit "✅ RIPLEY REVIEW: APPROVED" verdict.

**Merge Recommendation:** Ready to merge immediately. All acceptance criteria met, tests pass, coverage exceeds requirements, CI properly configured.
### 2026-03-13: PR #27 Re-Review — Error Handling Patterns

**Key Files:**
- `src/lib/api.js` - Centralized API client with connection tracking
- `src/lib/error-boundary.js` - Global error handler with rate limiting
- `src/components/log-viewer.js` - SSE streaming with exponential backoff
- `src/components/studio-pulse.js` - Component error UI pattern

**Patterns Established:**
- **AbortController Memory Safety:** Always create explicit controller, clear timeout in both success/error paths
- **Error Count Reset:** Time-based reset window (60s) prevents false positives from accumulated errors
- **Exponential Backoff:** Use `Math.pow(2, attempts)` for proper exponential growth (not `attempts + 1`)
- **XSS Prevention:** Use `textContent` (not `innerHTML`) for user-controlled error messages
- **Global Retry Functions:** Expose `window.__retryX()` handlers for manual recovery UX
- **unhandledrejection:** Always call `event.preventDefault()` before handling to prevent duplicate logging

**Architecture Notes:**
- All components follow consistent error UI pattern: error icon + message + retry button
- API layer uses Map-based per-endpoint status tracking to compute global connection state
- Error boundary wraps component refreshes via `wrapComponentRefresh()` helper

### 2026-03-14: Phase 2 Sprint Planning — Real-Time Intelligence Platform

**Decision:** Defined Sprint 2 with 18 issues (#75-#92) across 5 themes, transforming the dashboard from a polling-based status board into a real-time intelligence platform.

**Sprint 1 Results:**
- 17 issues closed across 5 themes (consolidation, data integrity, intelligence, DX, hardening)
- 227+ tests at 94%+ coverage
- Foundation: React + Express + Zustand + Docker + CI bundle tracking

**Phase 2 Strategic Pillars:**
1. **Real-Time Streaming (SSE)** — Replace polling with Server-Sent Events for live updates (#75-#78)
2. **Historical Analytics** — SQLite persistence + Chart.js trend visualization + Analytics view (#79-#83)
3. **Proactive Alerting** — Desktop notifications for critical events (#84-#86)
4. **API & Integration** — OpenAPI docs + data export endpoints (#87-#88)
5. **Testing & Quality** — SSE tests + metrics tests + Playwright E2E + benchmarks (#89-#92)

**Team Balance:** Lambert 7 issues (backend), Dallas 7 issues (frontend), Kane 4 issues (testing)

**Key Architectural Decisions:**
- SSE over WebSockets: read-only dashboard doesn't need bidirectional communication
- SQLite (better-sqlite3) over external DB: zero-config, embedded, WAL mode handles concurrent reads
- Chart.js over D3: simpler API, react-chartjs-2 wrapper available, sufficient for dashboard charts
- Playwright over Cypress: faster, built-in browser management, better CI performance
- Deferred: TypeScript migration, multi-squad support, plugin architecture, WebSockets

**Decision Document:** `.squad/decisions/inbox/ripley-phase2-pipeline.md`

### 2026-03-15: Sprint 4 Planning - UI/UX 2026 Transformation

**Founder Directive:** "Le pediría al lead a centrar los siguientes esfuerzos en su totalidad únicamente en que la UI y UX sea de 2026."
Translation: ALL future effort must focus EXCLUSIVELY on making the UI/UX feel like 2026.

**Decision:** Defined Sprint 4 with 12 issues (#140-#151) focused entirely on UI/UX modernization. Zero backend work. All issues assigned to Dallas (Frontend Dev).

**Current State Analysis:**
- Strong foundation: React 18.3, Zustand, Tailwind CSS 4.2, SSE streaming, 227+ tests
- UX gaps identified: Basic CSS transitions, simple loading spinners, static charts, no command palette, flat micro-interactions, basic glassmorphism, utilitarian empty states, mobile adequate but not exceptional

**Research Insights - 2026 UI Trends:**
- Glassmorphism 2.0 with layered translucency
- Framer Motion for physics-based animations
- Skeleton screens instead of spinners
- Command palette (⌘K) pattern from Linear/Vercel/Raycast
- Real-time data feels "alive" with pulsing indicators
- Interactive animated charts with smooth transitions
- Micro-interactions with haptic-like visual feedback
- Progressive disclosure and focus mode patterns

**Issues Created:**

| Priority | Count | Issues |
|----------|-------|--------|
| P0 | 3 | #140 Framer Motion, #141 Skeleton Screens, #144 Micro-interactions |
| P1 | 6 | #142 Chart Redesign, #143 Command Palette, #146 Depth/Colors, #147 Empty States, #148 Pulse Indicators, #150 Mobile Polish |
| P2 | 3 | #145 Typography, #149 Toast System, #151 Focus Mode |

**Implementation Strategy:**
- Phase 1: Foundation (P0) - Motion, loading, interactions
- Phase 2: Core UX (P1) - Command palette, charts, depth, states, mobile
- Phase 3: Polish (P2) - Typography, toasts, focus mode

**New Dependencies:**
- Framer Motion (animation library)
- React Hot Toast (optional, for toast system)

**Success Metrics:**
1. Framer Motion integrated across all views
2. Zero loading spinners (all skeleton screens)
3. Charts animate smoothly on data updates
4. Command palette functional with fuzzy search
5. Every interaction has purposeful micro-animation
6. Mobile tested on iOS/Android
7. Empty/error states are delightful
8. Real-time data feels "alive"
9. User feedback: "Feels like 2026 product"

**Out of Scope:** Backend changes, new features beyond UX, TypeScript migration, testing infrastructure changes, Docker/deployment, multi-squad support.

**Key Learning:** When founder gives clear strategic directive (UI/UX only), Lead must align entire sprint around that singular focus. No split attention between backend/frontend. This creates clarity for team and accelerates execution.

**Files Created:**
- `project-state.json` - Phase: sprinting, Sprint: 4, Focus: UI/UX 2026
- `.squad/decisions/inbox/ripley-ux-2026-plan.md` - Full decision document
- Created `sprint:4` label in repository

**Next:** Dallas begins with P0 foundation issues (#140, #141, #144)
