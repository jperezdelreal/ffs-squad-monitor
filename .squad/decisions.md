# Squad Decisions

## Active Decisions

### 1. PR Review Patterns & Standards (Ripley Lead - P1)

**Date:** 2026-03-12  
**Status:** Established  
**Context:** PRs #27, #29, #30 — First formal review session

**Decision 1a: Error Handling Pattern (PR #27)**

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

**Decision 1b: Test Coverage Standards (PR #29)**

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

**Decision 1c: Content-Aware Triage Heuristic (PR #30)**

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
### 2. GitHub Self-Approval Limitation (2026-03-13)
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
### 4. Package-lock.json Merge Strategy

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

### 5. Error Handling Architecture Review (PR #27)

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

### 6. Testing Infrastructure for ffs-squad-monitor (PR #29)

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

### 13. Phase 2 — Real-Time Intelligence Platform

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

### 14. User Directives (2026-03-14)
**By:** joperezd  
**Date:** 2026-03-14  
**Status:** ACTIVE  
**Tier:** T0

1. **Dashboard Independence:** ralph-watch.ps1 is NOT the primary data source. The dashboard must evolve freely without being constrained by existing monitoring scripts.

2. **UI Quality Priority:** Current UI is suboptimal. Future development requires building a quality tool with excellent UX/design.

3. **Creative Evolution:** Lead should continue evolving the dashboard with creative freedom in future roadmaps.

**Rationale:** User captured vision for dashboard maturity — move beyond status observer to first-class monitoring product with great UX.

---

### 15. Ralph Refueling Loop (Continuous Evolution)
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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
