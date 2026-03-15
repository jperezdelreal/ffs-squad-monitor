# Squad Decisions

## Active Decisions
### 1. GitHub Self-Approval Limitation (2026-03-13)
**Author:** Ripley (Lead)  
**Context:** PR #26, #29, #30 review — GitHub API constraints  
**Status:** Documented

GitHub API prevents users from approving their own PRs, even when authenticated as a repository member. When acting as Lead reviewer, attempted to formally approve PRs #26, #29, and #30 using `gh pr review --approve`, but received error: "Review Can not approve your own pull request (addPullRequestReview)".

**Impact:** Squad Lead cannot formally approve PRs when operating under the same GitHub account (jperezdelreal).

**Workaround:** Continue thorough code reviews as Lead, document review outcomes in PR comments with clear verdicts, and have the repository owner manually approve PRs after Lead review is complete. This does not compromise code quality — reviews remain rigorous.

**Related PRs:** #26 (Sprint Planning), #29 (Unit tests), #30 (Sync triage)

---

### 2. Error Handling Standards (2026-03-13)
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

---

### 3. Package-lock.json Merge Strategy

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

### 4. Error Handling Architecture Review (PR #27)

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

### 5. Testing Infrastructure for ffs-squad-monitor (PR #29)

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

### 6. Phase 2 — Real-Time Intelligence Platform

**Author:** Ripley (Lead)  
**Date:** 2026-03-14  
**Status:** APPROVED  
**Tier:** T1 (Lead authority)

**Context:** Sprint 1 closed 17 issues across 5 themes — architecture consolidation, data integrity, operational intelligence, developer experience, and production hardening. Foundation solid: single React architecture, authenticated Express backend, 227+ tests at 94%+ coverage, Zustand store, Docker deployment, CI with bundle tracking.

**Decision:** Phase 2 (Sprint 2) focuses on three strategic pillars transforming the dashboard from polling-based status board into a **real-time intelligence platform**:

1. **Real-Time Streaming (SSE)** — Replace 30-60s polling with Server-Sent Events. Backend has SSE infrastructure for logs; extend to all channels. Live heartbeat, events, issue state.

2. **Historical Analytics** — Add SQLite persistence for metrics over time. Enable trend charts (Chart.js), sprint velocity, agent productivity. New "Analytics" view.

3. **Proactive Alerting** — Desktop notifications for critical events (blocked agent, stale heartbeat, build failed). Configurable thresholds, notification history panel.

**Issues Created:** 18 issues (#75-#92) across 5 themes — Lambert 7, Dallas 7, Kane 4.

**What We're NOT Doing:** Multi-squad support (premature), WebSockets (SSE sufficient for read-only), TypeScript migration (revisit at 5000+ LOC), plugin architecture (5 views insufficient).

**Risks & Mitigations:**
- SSE reliability in corporate proxies → built-in polling fallback
- SQLite locking → better-sqlite3 WAL mode (concurrent reads + single writer)
- Chart.js bundle impact → tree-shake unused, track via CI
- E2E flakiness → 1 retry + screenshots + trace

**Success Metrics:**
- Live data updates without refresh
- 7-day and 30-day trend charts
- Desktop notifications for alerts
- E2E tests catch full-page failures
- ≥80% coverage on new modules
- API docs at /api/docs

---

### 7. Cross-repo communication rule
**By:** Coordinator  
**Tier:** T0  
**Status:** ✅ ACTIVE

No repo may make direct git commits to another repo's branch. ALL cross-repo communication goes through GitHub Issues. Each repo's Squad session owns its git state exclusively. This prevents push conflicts when multiple Ralph Go sessions run concurrently.

**Rule:** Use `gh issue create`, `gh issue comment`, `gh pr review` — NEVER `gh api repos/.../contents -X PUT`.

---

### 8. Ralph Refueling Behavior
**By:** Coordinator  
**Tier:** T1  
**Status:** ✅ ACTIVE

When Ralph detects an empty board (no open issues with squad labels, no open PRs), instead of idling he MUST:
1. Check if a "Define next roadmap" issue already exists
2. If none exists → create one with roadmap label
3. If one already exists → skip, just report "Roadmap issue already open, waiting for Lead."

**Why:** Prevents the autonomous pipeline from ever fully stopping. Complements perpetual-motion.yml (reactive) with proactive refueling.

---

### 9. Legacy Vanilla JS Architecture Removed
**Agent:** Dallas (Frontend Dev)  
**Status:** COMPLETED (PR #61 merged)

Removed all legacy vanilla JS files. The active frontend is now exclusively React (`main.jsx` → `App.jsx` → React components with Tailwind CSS).

**Removed:**
- `src/index.html`, `src/monitor.js`, `src/styles.css`
- `src/lib/error-boundary.js` + test file
- 10 vanilla JS components in `src/components/`

**Impact:** README updated, 22 tests removed, all other tests unaffected. Build output unchanged.

---

### 10. Config Centralization Architecture
**Agent:** Lambert (Backend Dev)  
**Status:** COMPLETED (PR #60 merged)

`server/config.js` is the single source of truth for REPOS and AGENTS configuration. Frontend accesses config via `/api/config` endpoint.

**Key Changes:**
- REPOS now include `color` field
- `/api/config` response includes owner/name transformation
- `dir` intentionally excluded from frontend
- Frontend caches config after first fetch

**Pattern:** To add/remove repo or agent, edit `server/config.js` — frontend picks it up automatically.

---

### 11. GitHub Token Auth Architecture
**Agent:** Lambert (Backend Dev)  
**Status:** COMPLETED (PR #62 merged)

All backend GitHub API calls now go through `server/lib/github-client.js` instead of `gh` CLI.

**Token Resolution:**
1. `process.env.GITHUB_TOKEN` (explicit)
2. `gh auth token` via execSync (fallback)
3. `null` (unauthenticated, 60 req/hr)

**Rate Limit Handling:**
- Headers parsed on every response
- Warning logged when remaining < 100
- 503 + `Retry-After` returned when exhausted

**Security:** Token stored server-side only, never serialized to frontend. `/health` exposes rate limit numbers but not the token.

---

### 12. Route React Components Through Express Backend
**Agent:** Lambert (Backend Dev)  
**Status:** COMPLETED (PR #65 merged)  
**Date:** 2026-03-13  
**Issue:** #36

All GitHub data now flows through Express backend instead of direct browser calls:

- `/api/events` — new endpoint, aggregated repo events with 30s cache
- `/api/issues?state=all` — updated board.js to support state query param
- Frontend components fetch from `/api/*` instead of calling GitHub directly

**Rationale:**
- Auth centralization — Backend has token; browser had 60 req/hr limit
- Rate limit protection — Single point of tracking and warning
- Cache benefits — 30s server-side cache prevents redundant calls
- Security — Token never reaches frontend

**Impact:** Frontend benefits from authenticated rate limits (5000 req/hr), CORS complexity eliminated.

---

### 13. User Directives (2026-03-14)
**By:** joperezd  
**Date:** 2026-03-14  
**Status:** ACTIVE  
**Tier:** T0

1. **Dashboard Independence:** ralph-watch.ps1 is NOT the primary data source. The dashboard must evolve freely without being constrained by existing monitoring scripts.

2. **UI Quality Priority:** Current UI is suboptimal. Future development requires building a quality tool with excellent UX/design.

3. **Creative Evolution:** Lead should continue evolving the dashboard with creative freedom in future roadmaps.

**Rationale:** User captured vision for dashboard maturity — move beyond status observer to first-class monitoring product with great UX.

---

### 14. Ralph Refueling Loop (Continuous Evolution)
**By:** joperezd  
**Date:** 2026-03-14  
**Status:** ACTIVE  
**Tier:** T0

When Ralph Go depletes the board (all issues closed), instead of idling, Ralph MUST:
1. Check if "Define next roadmap" issue exists
2. If none → create roadmap issue, continue working on it
3. If exists → report "Roadmap issue open, waiting for Lead" and work on it

**Why:** Creates a refuel loop ensuring autonomous evolution never stalls. Ralph continuously generates work when human directives are exhausted.

**Related:** Rule #8 (Ralph Refueling Behavior) was precursor; this expands scope to full continuous evolution model.

---

### 16. User Directive: UI/UX 2026 Focus (2026-03-14)
**By:** joperezd  
**Date:** 2026-03-14  
**Status:** ACTIVE  
**Tier:** T0

**Directive:** "Le pediría al lead a centrar los siguientes esfuerzos en su totalidad únicamente en que la UI y UX sea de 2026." (Focus ALL efforts exclusively on making UI/UX feel like 2026 — modern, polished, world-class.)

- No backend work. No infrastructure. Frontend excellence only.
- Dashboard must be accessible from anywhere via a link (open Azure issue to Syntax Sorcery if needed).
- After Sprint 4, iterative UI/UX refinement is the priority.

---

### 17. Issue #138 Triage Decision (2026-03-15)
**Author:** Ripley (Lead)  
**Date:** 2026-03-15  
**Status:** COMPLETED  
**Decision:** Reassign Issue #138 (Expand Test Suite with Integration Tests) from Dallas to Kane.

**Reasoning:** Issue is infrastructure testing work (integration/E2E tests, load tests, coverage targets) — Kane's domain, not frontend feature work.

**Labels Applied:**
- ✅ Removed: `squad:dallas`, `go:needs-research`
- ✅ Added: `squad:kane`, `go:yes`

**Rationale for `go:yes`:** Issue is well-defined with structured acceptance criteria, specific test scenarios (600+ tests, ≥30 integration, ≥20 E2E), measurable targets (80%+ coverage), and success metrics.

---

### 18. Sprint 4: UI/UX 2026 Transformation (2026-03-15)
**Author:** Ripley (Lead)  
**Date:** 2026-03-15  
**Status:** ACTIVE  
**Tier:** T1 (Lead authority)

**Founder Directive:** ALL future effort focuses EXCLUSIVELY on making UI/UX feel like 2026 — modern, polished, world-class.

**12 Issues Created (all assigned to Dallas):**
1. #140 — Framer Motion Integration (P0)
2. #141 — Loading States Overhaul: Skeleton Screens (P0)
3. #142 — Chart Redesign: Interactive Animated Data (P1)
4. #143 — Command Palette (⌘K) Implementation (P1)
5. #144 — Micro-interactions: Hover/Click Feedback (P0)
6. #145 — Typography and Spacing Refinement (P2)
7. #146 — Color System and Depth Enhancement (P1)
8. #147 — Empty and Error State Redesign (P1)
9. #148 — Real-time Data Pulse Indicators (P1)
10. #149 — Toast Notification System Upgrade (P2)
11. #150 — Mobile Responsive Polish (P1)
12. #151 — Focus Mode and Progressive Disclosure (P2)

**Foundation:** React 18.3, Zustand state, Tailwind CSS 4.2, SSE streaming, 227+ tests (94%+ coverage), Express backend, dark/light mode.

**UX Gaps Addressed:** Motion/animation, loading states, data visualization, keyboard navigation, micro-interactions, typography/spacing, depth/layering, empty/error states, real-time "alive" feel, notifications, mobile, progressive disclosure.

**Success Metrics:** Framer Motion integrated, zero spinners, animated charts, working command palette, micro-interactions on all interactive elements, polished mobile, delightful empty/error states, "alive" real-time feel, refined design system.

**Out of Scope:** Backend changes, API updates, TypeScript, Docker, multi-squad support, AI personalization.

---

### 20. Test Architecture Must Match Actual Code Architecture (2026-03-15)
**Date:** 2026-03-15  
**Author:** Dallas  
**Context:** PR #163 Test Failures (Issue #138)  

## Problem

Kane authored integration tests that assumed a different frontend architecture than what actually exists:
- Tests mocked `global.fetch` but components use Zustand store
- Tests referenced non-existent hooks (`useSessionStore`, `useMetricsStore`) 
- TrendCharts.jsx had duplicate component rendering bugs

This caused 60 test failures that blocked PR merge.

## Decision

**Component tests MUST use store-based mocking, not global.fetch mocking.**

### Rationale

1. **Architecture Reality:** Components consume data from `useStore` (Zustand), not directly from fetch
2. **Test Fidelity:** Tests should verify component behavior given store state, not API layer behavior
3. **Maintainability:** Store mocking is simpler and doesn't require URL-aware fetch mock routing

### Implementation Pattern

```javascript
import { useStore } from '../../store/store'

beforeEach(() => {
  useStore.setState({
    dataKey: [],
    dataKeyLoading: false,
    dataKeyError: null,
    fetchDataKey: vi.fn(),
  })
})

it('shows loading state', () => {
  useStore.setState({ dataKeyLoading: true })
  render(<Component />)
  // assert skeleton/loading UI
})

it('shows data after load', () => {
  useStore.setState({ dataKey: mockData })
  render(<Component />)
  // assert data renders
})
```

## Consequences

### Positive
- Tests are simpler (no URL routing in mocks)
- Tests match actual component dependencies
- Faster test execution (no fetch simulation overhead)

### Negative
- Existing tests using `global.fetch` must be updated
- Team must understand Zustand store architecture to write tests

## Follow-Up Actions

1. Document store-based testing pattern in `docs/testing.md`
2. Update remaining ~55 failing tests with same pattern
3. Add pre-commit hook to catch `global.fetch` in component tests

---

### 19. Integration Test Organization (2026-03-15)
**Author:** Kane (Tester)  
**Date:** 2026-03-15  
**Context:** Issue #138 - Expand test suite with integration tests  
**Status:** COMPLETED

Integration tests should be organized in a dedicated `src/__tests__/integration/` directory, separate from unit tests but within the source tree.

**Rationale:**
1. **Discoverability:** Keeping integration tests within `src/` maintains proximity to source code
2. **Test Type Clarity:** Separate `/integration/` subdirectory distinguishes integration tests from unit tests
3. **Vitest Compatibility:** Vitest automatically discovers tests in `__tests__/` directories regardless of depth
4. **Pattern Consistency:** Mirrors existing unit test patterns (`src/lib/__tests__/util.test.js`)
5. **Easy Filtering:** Can run specific test types via glob patterns

**Test Suites Created:**
- `src/__tests__/integration/sse-reconnection.test.js` (9 tests)
- `src/__tests__/integration/event-coalescing.test.js` (12 tests)
- `src/__tests__/integration/cross-feature-pipeline.test.js` (11 tests)
- `src/__tests__/integration/state-machine.test.js` (11 tests)
- `src/__tests__/integration/metrics-aggregation.test.js` (19 tests)

**Impact:** Clear separation between unit and integration tests. Integration tests now cover SSE reconnection, event coalescing, cross-feature pipelines, state machine transitions, and metrics aggregation. 704 total tests, ≥80% coverage maintained.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
