# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

### Testing Infrastructure (Issue #22 - 2026-03-12)
- **Vitest Configuration:** Established test infrastructure using Vitest 4.1.0 with happy-dom environment for DOM testing
- **Coverage Targets:** Achieved 97.61% coverage on src/lib/ modules (util, scheduler, api) - exceeding 80% requirement
- **Test Organization:** Created __tests__ subdirectories next to source files (e.g., src/lib/__tests__/)
- **Edge Case Focus:** Prioritized testing edge cases like null/undefined handling, boundary conditions, timer cleanup, and error scenarios
- **Module State Management:** API module maintains internal state (connection status, listeners) that persists across tests - used module reset strategy (vi.resetModules) where needed
- **CI Integration:** Added GitHub Actions workflow (.github/workflows/test.yml) for automated testing on PRs and main pushes
- **Test Scripts:** npm test (run once), npm run test:watch (watch mode), npm run test:coverage (coverage report)
- **Coverage Exclusions:** Exclude test files and coverage directory from git (.gitignore)

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-12: Issue #19 - Synced squad-triage.yml with Hub content-aware triage fix

**What was fixed:**
- Replaced unconditional `go:needs-research` label application in `.github/workflows/squad-triage.yml` with content-aware heuristic from Hub PR #191
- The old workflow blindly applied `go:needs-research` to every triaged issue, regardless of issue quality

**Content-aware heuristic logic:**
```javascript
// Analyze issue body for quality indicators
const body = issue.body || '';
const bodyLength = body.trim().length;
const hasAcceptanceCriteria = /acceptance\s+criteria/i.test(body);
const hasChecklist = /- \[ \]/.test(body);
const hasStructuredSections = /^##\s+.+/m.test(body);
const hasRequirements = /requirements/i.test(body);

// Well-defined = 100+ chars + quality indicator
const isWellDefined = bodyLength >= 100 && (hasAcceptanceCriteria || hasChecklist || hasStructuredSections || hasRequirements);
const triageLabel = isWellDefined ? 'go:ready' : 'go:needs-research';
```

**Key insight:** Issues with acceptance criteria, checklists, structured sections, or requirements (100+ chars) are considered "go:ready". Others get "go:needs-research" for clarification.

**Files modified:**
- `.github/workflows/squad-triage.yml` (lines 202-217)

**PR:** #27 (branch: squad/23-error-handling)

### 2026-03-13: Issue #38 — Fix CI blockers (test expectations + branch targeting)

**What was fixed:**
- All api.test.js error tests expected `null` but API returns `{error: true, message}` after PR #27's error handling changes (Decision #4a/#5)
- `toHaveBeenCalledWith('/api/...')` assertions failed because `safeFetch` now passes `{ signal: AbortSignal }` via AbortController
- Tests imported `isConnected()` which doesn't exist — API exports `getConnectionState()` with 3-tier state model (operational/degraded/offline)
- `squad-ci.yml` targeted `master` instead of `main`

**Key insight:** When API behavior changes (null → error objects, bare fetch → AbortController), ALL test assertions touching that surface must be updated — not just the obvious ones. Found 9 additional failures beyond the 4 originally reported.

**Files modified:**
- `src/lib/__tests__/api.test.js` — 10 test expectations updated
- `.github/workflows/squad-ci.yml` — branch targeting master → main

**PR:** #58 (branch: squad/38-fix-ci-blockers)

### 2026-03-13: Issue #49 — Service tests for github.js

**What was done:**
- Created `src/services/__tests__/github.test.js` with 30 tests covering all 6 exported functions + REPOS constant
- Extended `vitest.config.js` coverage to include `src/services/**/*.js`
- Achieved 100% coverage on github.js (statements, branches, functions, lines)

**Key insight:** The github.js service functions return `[]` on error (not `{error: true, message}` like the API layer). This is a different error-handling contract — the service layer silently degrades while the API layer surfaces errors to components. Both patterns are valid for their contexts: services feed aggregation functions that need arrays, while API functions feed UI components that need error states.

**Edge cases tested:**
- 403 rate limit, 404 not found, 500 server error
- Network failures (fetch rejection)
- Partial failures in aggregation functions (some repos fail, others succeed)
- Result capping (fetchAllRepoEvents caps at 50)
- Missing data (fetchWorkflowRuns with no workflow_runs key)
- getRepoColor with paths, unknown repos, empty strings

**Files created/modified:**
- `src/services/__tests__/github.test.js` — new (30 tests)
- `vitest.config.js` — coverage include extended

**PR:** #59 (branch: squad/49-github-service-tests)

### 2026-03-13: Issue #48 — Component tests for JSX components

**What was done:**
- Created `src/components/__tests__/` with test files for all 7 React components
- Added @testing-library/react, @testing-library/jest-dom, @testing-library/user-event as dev dependencies
- Updated vitest.config.js: added React plugin, component coverage include, setup file with jest-dom matchers
- 81 new component tests, all passing (182 total across project)

**Coverage achieved:**
- ActivityFeed: 100% statements, 92.68% branches
- PipelineVisualizer: 100% statements, 83.33% branches
- TeamBoard: 100% statements, 97.22% branches
- CostTracker: 92% statements, 100% branches
- Header: 100% all metrics
- Sidebar: 100% all metrics
- ErrorBoundary: 100% all metrics

**Key insights:**
- Agent names (e.g. "Ripley") appear in both card titles and workload chart — use `getAllByText` not `getByText`
- CostTracker was refactored on another branch (squad/42-real-cost-data) but main still uses mockData pattern — tests must match the branch's actual component code
- ErrorBoundary uses class component pattern (getDerivedStateFromError) — needs special test approach with ThrowingComponent helper
- Some compound emoji characters (e.g. 👩‍🚀) contain invisible joiners that can cause text matching issues

**Files created:**
- `src/components/__tests__/setup.js`
- `src/components/__tests__/ActivityFeed.test.jsx` (12 tests)
- `src/components/__tests__/PipelineVisualizer.test.jsx` (15 tests)
- `src/components/__tests__/TeamBoard.test.jsx` (11 tests)
- `src/components/__tests__/CostTracker.test.jsx` (14 tests)
- `src/components/__tests__/Header.test.jsx` (10 tests)
- `src/components/__tests__/Sidebar.test.jsx` (8 tests)
- `src/components/__tests__/ErrorBoundary.test.jsx` (7 tests)

**Files modified:**
- `vitest.config.js` — React plugin, setupFiles, coverage include
- `package.json` — testing-library devDependencies

**PR:** #68 (branch: squad/48-component-tests)

### 2026-03-14: Issues #89 + #90 — SSE integration tests + Historical metrics tests

**What was done:**
- Created 5 new test files with 108 tests covering SSE and metrics infrastructure
- `server/api/__tests__/sse.test.js` (17 tests): SSE endpoint validation, headers, connection lifecycle, event streaming format, Last-Event-ID replay, keepalive, concurrent connections
- `server/lib/__tests__/metrics-db.test.js` (36 tests): SQLite DB auto-creation, schema migration, snapshot CRUD, interval aggregation (5m/1h/1d), retention policy, daily summaries
- `server/lib/__tests__/snapshot-service.test.js` (13 tests): Snapshot hash dedup, error handling, daily summary computation, service lifecycle
- `server/lib/__tests__/agent-metrics.test.js` (19 tests): Per-agent metrics, cycle time median, blocked time, PR linking (labels/body/branch), caching
- `server/api/__tests__/metrics.test.js` (23 tests): All /api/metrics endpoints, query param validation, 400/500 error responses
- Updated `vitest.config.js` coverage include to track `src/hooks/` and `server/api/` modules

**Key insights:**
- vi.mock factories are hoisted to file top — can't reference variables declared after them. Use `vi.hoisted()` to create mocks that need to be shared between the mock factory and test code
- `fetchSquadIssues` / `fetchAllPRs` break pagination early when result count < 100, so mock response ordering must account for fewer calls than expected
- `better-sqlite3` supports WAL mode for concurrent reads — verified in tests via pragma check
- Agent metrics uses median (not mean) for avg cycle time — important for accuracy with outliers

**Files created:**
- `server/api/__tests__/sse.test.js`
- `server/lib/__tests__/metrics-db.test.js`
- `server/lib/__tests__/snapshot-service.test.js`
- `server/lib/__tests__/agent-metrics.test.js`
- `server/api/__tests__/metrics.test.js`

**Files modified:**
- `vitest.config.js` — coverage include extended

**PR:** #108 (branch: squad/89-90-integration-tests)
