# Squad Decisions

## Active Decisions

### 1. Backend API Extraction Architecture (Ripley - P0)

**Date:** 2026-03-12  
**Status:** Approved with blocking fix required  
**Context:** PR #28 — Extract Backend API to Dedicated Server Module  
**Issue:** #21

**Decision:** APPROVE backend extraction with one fix required.

**Architecture:**
```
server/
├── index.js          # Express app entry, route registration, port 3001
├── config.js         # Centralized config
└── api/
    ├── heartbeat.js  # Ralph heartbeat status
    ├── logs.js       # JSONL log access + SSE streaming
    ├── timeline.js   # Round-by-round timeline view
    ├── board.js      # Cross-repo issue board (30s cache)
    ├── pulse.js      # Studio pulse metrics
    ├── repos.js      # Repository status
    └── workflows.js  # Agent roster and activity
```

**Critical Issue (BLOCKING):** Error handling middleware registered BEFORE routes in `server/index.js:14-18`. Express requires error handlers AFTER all routes. Must move error handler to end of middleware chain before `app.listen()`.

**Rationale:**
- Reduces 26KB monolithic vite.config.js to modular handlers
- Enables independent backend deployment
- Improves testability and performance
- Maintains heartbeat file watching and SSE streaming patterns

**Acceptance Criteria Status:**
- ✅ server/ directory with modular structure
- ✅ Vite proxy configuration
- ✅ server/config.js for configuration
- ✅ package.json "server" script
- ✅ README updated with dual-server instructions
- ✅ All tests passing
- ⚠️ Error handler placement needs fix

---

### 2. Test Infrastructure Decision (Kane - P1)

**Date:** 2026-03-12  
**Status:** Approved  
**Context:** Issue #22  
**PR:** #29

**Decision:** Selected Vitest as testing framework with 80%+ coverage requirement.

**Configuration:**
- **Test Framework:** Vitest 4.1.0
- **Environment:** happy-dom (lightweight DOM implementation)
- **Coverage Provider:** v8
- **Coverage Thresholds:** 80% for lines, branches, functions, statements

**Rationale:**
1. Vitest over Jest: Better Vite integration, faster execution, native ESM support
2. happy-dom over jsdom: Lighter weight, faster, sufficient for DOM needs
3. v8 coverage: Native, accurate, performant reporting

**Implementation:**
- Test files in `src/lib/__tests__/` directory
- Configuration in `vitest.config.js`
- CI workflow in `.github/workflows/test.yml`

**Results:**
- 50 tests written across 3 modules
- 97.61% coverage achieved (exceeding 80% target)
- All tests pass consistently

---

### 3. Vitest Configuration: passWithNoTests Option (Lambert - P1)

**Date:** 2026-03-12  
**Status:** Implemented  
**Context:** PR #28 (backend extraction) + PR #29 (unit tests)

**Decision:** Added `test: { passWithNoTests: true }` to vite.config.js instead of package.json flags.

**Rationale:**
1. Configuration belongs in config file, not CLI flags
2. Vitest convention (reads from vite.config.js by default)
3. Keeps package.json scripts simple and consistent
4. Allows incremental development—backend and tests can land separately

**Impact:**
- CI passes on branches without test files
- Test command behavior remains consistent across all npm test variants
- No breaking changes to existing test files

---

### 4. PR Review Patterns & Standards (Ripley Lead - P1)

**Date:** 2026-03-12  
**Status:** Established  
**Context:** PRs #27, #29, #30 — First formal review session

**Decision 4a: Error Handling Pattern (PR #27)**

Pattern adopted across codebase:
- API functions return `{error: true, message}` instead of `null` on failure
- Components check `data?.error` and call dedicated `renderXError()` functions
- Global retry functions exposed as `window.__retryX()` for onclick handlers
- Connection state uses 3-tier model: operational/degraded/offline

Rationale:
- Provides error context to UI layer
- Consistent pattern across all 7 components
- User-facing recovery without page reload
- Distinguishes total failure vs. partial degradation

**Decision 4b: Test Coverage Standards (PR #29)**

Baseline established:
- Minimum 80% coverage enforced via vitest.config.js thresholds
- Tests focus on edge cases (null/undefined, boundaries, cleanup)
- Test organization: `__tests__/` subdirectories next to source files
- CI must run tests + coverage on all PRs

Rationale:
- 80% threshold catches most regression risk without perfectionism
- Edge case focus prevents brittle production code
- Co-located tests improve discoverability
- CI enforcement prevents coverage decay

**Decision 4c: Content-Aware Triage Heuristic (PR #30)**

Quality indicators for go:ready label:
- Issue body ≥100 characters
- AND contains: acceptance criteria OR checklist OR structured sections OR requirements

Rationale:
- Eliminates manual triage bottleneck for well-defined issues
- Multiple signals reduce false positives
- Length threshold prevents gaming with minimal content
- Aligned with Hub's proven approach

**Note:** GitHub API prevents self-approval of PRs. For solo projects where reviewer == author, post formal review comments with explicit verdicts instead of using approval API.

---

### 5. Error Handling Architecture (Dallas - Frontend)

**Date:** 2026-03-12  
**Status:** Implemented  
**Issue:** #23

**Decision:** Implemented comprehensive error handling with 3-state connection tracking and component-level retry mechanisms.

**Architecture:**
1. **Connection States:** API layer tracks operational, degraded, offline
2. **Error Boundaries:** Global handler catches component crashes, shows notifications
3. **SSE Reconnection:** Exponential backoff (1s → 2s → 4s → 8s → max 30s) with 10 max retries
4. **Component Errors:** Every component renders error state with retry button
5. **Error Logging:** All API errors logged with endpoint, status, timestamp

**Files Modified:**
- `src/lib/api.js` - Connection state tracking
- `src/lib/error-boundary.js` - Global error handler (new)
- All components in `src/components/` - Error states added
- `src/monitor.js` - Error boundary integration
- `src/styles.css` - Error UI styles

**Impact:**
- Better UX: Users see what's broken and can retry
- Better DX: Console logs make debugging easier
- Resilience: Dashboard stays functional if backend is down
- Consistency: Error handling pattern across all components
### GitHub Self-Approval Limitation (2026-03-13)
**Author:** Ripley (Lead)  
**Context:** PR #26, #29, #30 review — GitHub API constraints  
**Status:** Documented

GitHub API prevents users from approving their own PRs, even when authenticated as a repository member. When acting as Lead reviewer, attempted to formally approve PRs #26, #29, and #30 using `gh pr review --approve`, but received error: "Review Can not approve your own pull request (addPullRequestReview)".

**Impact:** Squad Lead cannot formally approve PRs when operating under the same GitHub account (jperezdelreal).

**Workaround:** Continue thorough code reviews as Lead, document review outcomes in PR comments with clear verdicts, and have the repository owner manually approve PRs after Lead review is complete. This does not compromise code quality — reviews remain rigorous.

**Related PRs:** #26 (Sprint Planning), #29 (Unit tests), #30 (Sync triage)

---

### Error Handling Standards (2026-03-13)
**Author:** Ripley (Lead)  
**Context:** PR #27 review — Error handling and offline resilience  
**Status:** Approved

Establish standard error handling patterns for all dashboard components:

1. **Memory-Safe Timeouts** — Always create explicit `AbortController` and clear timeouts in both success and error paths
2. **Error Count Rate Limiting** — Use time-based reset windows to prevent false positives
3. **Exponential Backoff** — Use `Math.min(1000 * Math.pow(2, attempts), maxDelay)`, not linear delays
4. **XSS Prevention in Error Messages** — Always use `textContent` for user-controlled content, never `innerHTML`
5. **Promise Rejection Handling** — Prevent duplicate logging with `preventDefault()` as first call
6. **Component Error UI Pattern** — Standard error state structure with icon, message, and retry button

These patterns prevent memory leaks, false positives, XSS vulnerabilities, duplicate logging, and inconsistent error UX.
### Package-lock.json Merge Strategy

**Date:** 2026-03-13  
**Agent:** Lambert (Backend Dev)  
**Context:** PR #28 merge conflict resolution

**Decision:** Always regenerate `package-lock.json` via `npm install` after manually resolving `package.json` conflicts.

**Rationale:**
1. **Correctness**: npm's lockfile resolver handles transitive dependencies, version resolution, and integrity hashes correctly
2. **Safety**: Manual lockfile editing risks breaking the dependency tree or introducing version mismatches
3. **Efficiency**: Regeneration takes ~3s vs manual conflict resolution which is time-consuming and risky

**Implementation:**
```bash
git checkout --theirs package-lock.json  # or --ours, doesn't matter
git add package.json
npm install  # Regenerates lockfile with merged dependencies
git add package-lock.json
```

**Outcome:** Applied successfully in PR #28 — merged express/cors dependencies with vitest dependencies with zero manual conflict resolution in lockfile.

---

### Error Handling Architecture Review (PR #27)

**Date:** 2026-03-12  
**Author:** Ripley (Lead)  
**Status:** Approved (after Lambert's fixes)  
**Context:** PR #27 implementing Issue #23 - Error Handling & Offline Resilience

**Decision:** Error handling architecture is fundamentally sound. Requested 4 critical fixes before initial approval:

1. **studio-pulse.js** - Add retry UI (cannot ship with only dashes on error)
2. **error-boundary.js** - Add errorCount reset logic (prevent permanent degradation)
3. **log-viewer.js** - Fix backoff timing off-by-one error
4. **api.js** - Use explicit AbortController (prevent memory leaks)

**Principle:** Error handling must be comprehensive, not selective. If adding error states, ALL components need them. Re-reviewed after fixes and approved.

---

### Testing Infrastructure for ffs-squad-monitor (PR #29)

**Date:** 2026-03-12  
**Status:** Approved  
**Decider:** Ripley (Lead)  
**Context:** PR #29 - Issue #22 implementation

**Decision:** Established Vitest-based testing infrastructure with 80% coverage enforcement and CI integration.

**Rationale:**
- Vitest: Native ESM support, fast execution, happy-dom environment
- 80% threshold: Industry standard, achievable without forcing meaningless tests (team achieved 97.61%)
- Adjacent __tests__ directories: Clear proximity without file mixing
- happy-dom: Lighter weight than jsdom, sufficient for project scope

**Team Guidance:**
- New lib modules must include tests achieving 80%+ coverage
- Use vi.useFakeTimers() for time-dependent code
- Mock fetch API for network calls
- Test edge cases: null/undefined, boundaries, error paths

---
### Error Handling Standards (2026-03-13)
**Author:** Ripley (Lead)  
**Context:** PR #27 review — Error handling and offline resilience  
**Status:** Approved

Establish standard error handling patterns for all dashboard components:

1. **Memory-Safe Timeouts** — Always create explicit `AbortController` and clear timeouts in both success and error paths
2. **Error Count Rate Limiting** — Use time-based reset windows to prevent false positives
3. **Exponential Backoff** — Use `Math.min(1000 * Math.pow(2, attempts), maxDelay)`, not linear delays
4. **XSS Prevention in Error Messages** — Always use `textContent` for user-controlled content, never `innerHTML`
5. **Promise Rejection Handling** — Prevent duplicate logging with `preventDefault()` as first call
6. **Component Error UI Pattern** — Standard error state structure with icon, message, and retry button

These patterns prevent memory leaks, false positives, XSS vulnerabilities, duplicate logging, and inconsistent error UX.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
