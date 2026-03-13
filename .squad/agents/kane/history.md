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
