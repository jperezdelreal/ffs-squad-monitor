# FFS Squad Monitor — Strategic Roadmap

> Defined by Ripley (Lead) · March 2026 · Issue #34

---

## Executive Summary

**Where we are:** FFS Squad Monitor is a v0.1.0 real-time monitoring dashboard that has completed two major build phases — Sprint 0 (core vanilla JS features: heartbeat, logs, timeline, cross-repo board, workflows) and Sprint 1 (React redesign with ActivityFeed, PipelineVisualizer, TeamBoard, CostTracker, and Mouse's glassmorphism UI). The result is a visually polished dashboard with strong foundational infrastructure: Express backend on port 3001, 97%+ test coverage on core libs, 3-state connection tracking, SSE streaming, and CI/CD via GitHub Actions.

**Where we're going:** The dashboard needs to transition from *demo-quality* to *production-quality*. Today, we have two co-existing architectures (React + legacy vanilla JS), configuration duplicated in three places, mock data masquerading as real data, and no GitHub API authentication. The next phase focuses on architectural consolidation, data integrity, and operational intelligence — making this a tool that FFS team members actually rely on to make decisions about squad operations.

**Why it matters:** A monitoring dashboard that shows stale or mock data is worse than no dashboard — it creates false confidence. Every shortcut we took to ship fast now needs to be paid back. The roadmap is organized into five strategic themes that systematically close the gap between what the dashboard *shows* and what's *actually happening* across FFS squads.

---

## Current State Assessment

### What's Working

| Area | Status | Evidence |
|------|--------|----------|
| **React UI** | ✅ Stable | 6 JSX components with loading/error states, glassmorphism design |
| **Express Backend** | ✅ Stable | 7 modular API handlers, SSE streaming, health check endpoint |
| **Core Lib Tests** | ✅ Strong | 50 tests, 97.61% coverage on util/scheduler/api |
| **Error Handling** | ✅ Comprehensive | 3-state connection tracking, exponential backoff, component error states |
| **CI/CD** | ✅ Functional | Build, test, deploy workflows; GitHub Pages deployment |
| **Documentation** | ✅ Good | PRD, deployment guide, redesign doc, C4 features |

### What's Broken or Incomplete

| Issue | Severity | Detail |
|-------|----------|--------|
| **Dual architecture** | 🔴 Critical | `index.html` → React (`main.jsx`), `src/index.html` → vanilla JS (`monitor.js`). Both exist, legacy is dead code consuming maintenance bandwidth |
| **Config duplication** | 🔴 Critical | REPOS defined in 3 places (vite.config.js, server/config.js, services/github.js) with different counts (3, 3, 6). AGENTS defined in 3 places with different names and counts (15 backend vs 8 frontend mock) |
| **Mock data in production** | 🟠 High | CostTracker shows fabricated €0 data. TeamBoard falls back to hardcoded agent list. No clear boundary between real and mock |
| **No GitHub auth** | 🟠 High | Frontend service calls unauthenticated GitHub API (60 req/hr limit). With 6 repos × 3 components × polling, rate limiting is inevitable |
| **React components don't use backend** | 🟠 High | New JSX components call GitHub API directly from browser (services/github.js) instead of going through Express backend. Backend API handlers (heartbeat, logs, timeline, board) are only used by legacy system |
| **Zustand store unused** | 🟡 Medium | Store exists with 4 fields. No component reads from it except Header (via usePolling). ActivityFeed/PipelineVisualizer/TeamBoard each maintain local state |
| **No component tests** | 🟡 Medium | Zero test coverage on any component (JSX or legacy). Zero tests on services. Only lib/ is tested |
| **CI branch mismatch** | 🟡 Medium | squad-ci.yml triggers on `master`, deploy.yml triggers on `main`. Default branch is `main` |
| **Hardcoded heartbeat URL** | 🟡 Medium | usePolling.js fetches from hardcoded Syntax-Sorcery raw GitHub URL instead of backend /api/heartbeat |
| **Legacy components as dead code** | 🟡 Medium | 10 vanilla JS components in src/components/ referenced only by src/monitor.js which is no longer the active entry point |

### Architecture Diagram (Current)

```
┌──────────────────────────────────────────────────────────┐
│ Browser                                                   │
│                                                           │
│  index.html → main.jsx → App.jsx (ACTIVE)                │
│  ├── ActivityFeed.jsx  ──→ GitHub API (direct, no auth)   │
│  ├── PipelineVisualizer.jsx ──→ GitHub API (direct)       │
│  ├── TeamBoard.jsx ──→ GitHub API + mockData.js           │
│  ├── CostTracker.jsx ──→ mockData.js (100% fake)          │
│  └── usePolling.js ──→ raw.githubusercontent.com          │
│                                                           │
│  src/index.html → monitor.js (LEGACY, unused)             │
│  ├── heartbeat.js ──→ /api/heartbeat                      │
│  ├── log-viewer.js ──→ /api/logs/stream (SSE)             │
│  ├── timeline.js ──→ /api/timeline                        │
│  └── cross-repo-board.js ──→ /api/issues                  │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ Express Backend (port 3001) — underutilized by React UI   │
│  /api/heartbeat, /api/logs, /api/timeline, /api/issues    │
│  /api/pulse, /api/agents, /api/repos, /health             │
│  Uses: gh CLI, fs.watch, file tailing, SSE streaming      │
└──────────────────────────────────────────────────────────┘
```

---

## Strategic Themes

### Theme 1: Architecture Consolidation (P0)

**Why:** Two architectures creates confusion, doubles maintenance surface, and means the Express backend — our most robust data layer — is barely used by the React UI. The React components bypass it entirely to hit GitHub's API directly from the browser, which is unauthenticated, rate-limited, and uncached. This is the single biggest structural risk.

**Goal:** One architecture, one data path, one source of truth for configuration.

**Success Metrics:**
- Zero legacy vanilla JS components in src/components/
- All React components fetch data through Express backend (no direct GitHub API from browser)
- REPOS and AGENTS defined in exactly one place
- src/index.html and src/monitor.js removed
- CI workflows all target `main` branch

**Issues:**
| # | Title | Priority | Assignee |
|---|-------|----------|----------|
| #35 | Remove legacy vanilla JS architecture | P0 | Dallas |
| #36 | Route React components through Express backend | P0 | Lambert |
| #37 | Centralize REPOS/AGENTS configuration | P0 | Lambert |
| #38 | Fix CI branch targeting (master → main) | P0 | Kane |

**Dependencies:** Config centralization should land first, then backend routing, then legacy removal.

---

### Theme 2: Data Integrity (P0)

**Why:** A monitoring dashboard showing mock data is actively harmful — it creates false confidence. Today, CostTracker is 100% fabricated, TeamBoard mixes real and fake data, and there's no visual distinction between real and mock data. Users cannot trust what they see.

**Goal:** Every number on the dashboard either reflects reality or is explicitly marked as unavailable.

**Success Metrics:**
- Zero mock data rendered without explicit "[mock]" or "[demo]" labels
- CostTracker either shows real GitHub Actions usage data or displays "No cost data available"
- TeamBoard agent list comes from backend, not hardcoded array
- GitHub API calls authenticated (5000 req/hr vs 60 req/hr)
- Heartbeat data fetched from backend /api/heartbeat, not hardcoded GitHub raw URL

**Issues:**
| # | Title | Priority | Assignee |
|---|-------|----------|----------|
| #39 | Add GitHub token authentication to backend API calls | P0 | Lambert |
| #40 | Replace mock agent data with backend /api/agents | P1 | Dallas |
| #41 | Replace CostTracker mock data with real GH Actions usage | P1 | Lambert |
| #42 | Route heartbeat polling through Express backend | P1 | Dallas |

**Dependencies:** GitHub auth must land before real data integration.

---

### Theme 3: Operational Intelligence (P1)

**Why:** The dashboard shows data but doesn't help users make decisions. A good monitoring tool should answer: "Is anything broken right now?", "Which agent is blocked?", "Is the pipeline healthy?", "Should I intervene?" Today, users must interpret raw data themselves.

**Goal:** Add actionable signals — alerts, anomaly detection, health scores, and drill-down capabilities.

**Success Metrics:**
- Dashboard shows a global health score (green/yellow/red) at a glance
- Blocked agents are prominently surfaced with time-in-blocked-state
- Pipeline bottlenecks highlighted (stages where issues accumulate)
- Heartbeat staleness triggers visible alert (not just "last updated N minutes ago")

**Issues:**
| # | Title | Priority | Assignee |
|---|-------|----------|----------|
| #44 | Add global health score to Header | P1 | Dallas |
| #45 | Add heartbeat staleness alerts | P1 | Dallas |
| #46 | Add pipeline bottleneck detection | P2 | Dallas |
| #47 | Add agent blocked-time tracking | P2 | Lambert |

**Dependencies:** Requires Theme 2 (real data) to be meaningful.

---

### Theme 4: Developer Experience & Test Coverage (P1)

**Why:** The test suite covers 97% of lib/ but 0% of components and services. With 16 components (6 JSX + 10 legacy), a single refactor could break the UI silently. The Zustand store is unused, making state management ad-hoc. And extending the dashboard requires understanding two separate architectures.

**Goal:** Make the codebase easy to extend, safe to refactor, and fast to test.

**Success Metrics:**
- Component test coverage ≥60% for all JSX components
- Service test coverage ≥80% for github.js
- Zustand store manages all shared state (connection, data, errors)
- React Error Boundary wraps component tree
- Request deduplication prevents redundant API calls

**Issues:**
| # | Title | Priority | Assignee |
|---|-------|----------|----------|
| #48 | Add component tests for JSX components | P1 | Kane |
| #49 | Add service tests for github.js | P1 | Kane |
| #50 | Expand Zustand store for centralized state | P1 | Dallas |
| #51 | Add React Error Boundary component | P1 | Dallas |
| #52 | Implement request deduplication/caching layer | P2 | Lambert |

**Dependencies:** Architecture consolidation (Theme 1) should land before extensive component testing to avoid testing dead code.

---

### Theme 5: Production Hardening (P2)

**Why:** The dashboard monitors other systems but doesn't monitor itself. There's no structured logging, no performance tracking, no graceful degradation documentation, and deployment relies on manual steps or basic GitHub Pages.

**Goal:** Make the dashboard reliable enough to run unattended.

**Success Metrics:**
- Health check endpoint returns meaningful diagnostics (not just 200 OK)
- Backend logs structured (JSON) with request timing
- Bundle size tracked and regression-tested in CI
- Docker deployment option documented and tested
- Error rates tracked over time (not just current state)

**Issues:**
| # | Title | Priority | Assignee |
|---|-------|----------|----------|
| #53 | Enhanced health check with dependency status | P2 | Lambert |
| #54 | Add structured logging to Express backend | P2 | Lambert |
| #55 | Add bundle size tracking to CI | P2 | Kane |
| #56 | Validate Docker deployment path | P2 | Lambert |

**Dependencies:** Can proceed in parallel with Themes 1-4.

---

## Prioritized Backlog

| # | Title | Priority | Theme | Assignee | Dependencies | Effort |
|---|-------|----------|-------|----------|--------------|--------|
| #35 | Remove legacy vanilla JS architecture | P0 | 1: Consolidation | Dallas | Config centralization (#37) | M |
| #36 | Route React components through Express backend | P0 | 1: Consolidation | Lambert | Config centralization (#37) | L |
| #37 | Centralize REPOS/AGENTS configuration | P0 | 1: Consolidation | Lambert | None | S |
| #38 | Fix CI branch targeting (master → main) | P0 | 1: Consolidation | Kane | None | XS |
| #39 | Add GitHub token auth to backend API calls | P0 | 2: Data Integrity | Lambert | None | S |
| #40 | Replace mock agent data with backend /api/agents | P1 | 2: Data Integrity | Dallas | #36, #39 | M |
| #41 | Replace CostTracker mock data with real GH Actions usage | P1 | 2: Data Integrity | Lambert | #39 | M |
| #42 | Route heartbeat polling through Express backend | P1 | 2: Data Integrity | Dallas | #36 | S |
| #44 | Add global health score to Header | P1 | 3: Intelligence | Dallas | Theme 2 | M |
| #45 | Add heartbeat staleness alerts | P1 | 3: Intelligence | Dallas | #42 | S |
| #48 | Add component tests for JSX components | P1 | 4: DX & Testing | Kane | #35 (legacy removal) | L |
| #49 | Add service tests for github.js | P1 | 4: DX & Testing | Kane | None | M |
| #50 | Expand Zustand store for centralized state | P1 | 4: DX & Testing | Dallas | None | M |
| #51 | Add React Error Boundary component | P1 | 4: DX & Testing | Dallas | None | S |
| #46 | Add pipeline bottleneck detection | P2 | 3: Intelligence | Dallas | Theme 2 | M |
| #47 | Add agent blocked-time tracking | P2 | 3: Intelligence | Lambert | #40 | M |
| #52 | Implement request deduplication/caching layer | P2 | 4: DX & Testing | Lambert | #50 | M |
| #53 | Enhanced health check with dependency status | P2 | 5: Hardening | Lambert | None | S |
| #54 | Add structured logging to Express backend | P2 | 5: Hardening | Lambert | None | M |
| #55 | Add bundle size tracking to CI | P2 | 5: Hardening | Kane | None | S |
| #56 | Validate Docker deployment path | P2 | 5: Hardening | Lambert | None | M |

**Effort Key:** XS (<1h), S (1-3h), M (3-8h), L (8-16h)

---

## Technical Debt & Risks

### Critical Debt

1. **Dual architecture** — Two rendering systems, two entry points, two data flow patterns. Every feature change requires understanding which system is active. Cost: confusion, bugs from touching wrong system.

2. **Configuration scattered** — REPOS defined differently in vite.config.js (3 repos), server/config.js (3 repos), and services/github.js (6 repos). AGENTS defined differently in server/config.js (15 agents), vite.config.js (17 agents), and mockData.js (8 agents with different names entirely). This **will** cause data inconsistencies.

3. **Frontend bypasses backend** — React components call GitHub API directly from the browser, while the Express backend has proper caching, error handling, and gh CLI integration sitting idle. This defeats the purpose of the backend extraction (Issue #21).

### High-Priority Debt

4. **No API rate limiting strategy** — Unauthenticated GitHub API from browser = 60 req/hr. Six repos × three components × 60-second polling = potential 18 requests/minute. Will hit limits within 3 minutes of dashboard usage.

5. **Mock data without markers** — CostTracker shows "€0" and "420/2000 CI minutes" with no indication this is fabricated. TeamBoard agent list doesn't match actual FFS agents. Users may make incorrect operational decisions based on fake data.

6. **Error handler placement in server/index.js** — Previously identified: Express error middleware must be registered AFTER routes. This was flagged in PR #28 review but may not have been fixed.

### Medium-Priority Debt

7. **Hardcoded external URL in usePolling.js** — Points to `raw.githubusercontent.com/jperezdelreal/Syntax-Sorcery/main/.squad/heartbeat/ralph.json`. If that repo goes private or is deleted, the heartbeat silently fails.

8. **No component test coverage** — 16 components with 0% test coverage. Any refactor is unprotected.

9. **CI targets wrong branch** — squad-ci.yml targets `master` but default branch is `main`. Tests may not run on PRs.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub API rate limit hit in production | High | Dashboard shows stale data | Theme 2: Add auth token |
| Legacy code accidentally modified | Medium | Wasted effort on dead code | Theme 1: Remove legacy |
| Config drift between three definitions | High | Wrong repos/agents displayed | Theme 1: Centralize config |
| Mock data mistaken for real data | Medium | Incorrect operational decisions | Theme 2: Label or remove mocks |
| Component refactor breaks UI | Medium | Regression without CI catch | Theme 4: Component tests |

---

## Technical Bets

### Invest Now

- **Backend-first data architecture** — All data flows through Express. The backend handles caching, authentication, rate limiting, and data aggregation. Frontend becomes a pure rendering layer. This is the correct architecture for a monitoring tool and pays dividends on every future feature.

- **Zustand as single state tree** — Expand the store to hold all component data, connection state, and error state. This enables request deduplication, optimistic updates, and makes component testing dramatically easier (inject store state, assert rendered output).

### Evaluate Next Quarter

- **Server-Sent Events for React** — The legacy log-viewer.js already has excellent SSE implementation with exponential backoff. Once React components route through the backend, SSE can replace polling for real-time updates. This is a natural evolution, not a rewrite.

- **WebSocket upgrade** — Only if SSE proves insufficient. SSE covers 90% of monitoring use cases (server-to-client push). WebSockets add complexity (connection management, reconnection, protocol negotiation) for marginal benefit in a read-only dashboard.

### Defer

- **Plugin architecture** — The dashboard has 4 views. Adding extensibility before stabilizing the core is premature. Revisit when there's demand for custom views from other teams.

- **Multi-squad support** — Current architecture assumes single FFS organization. Multi-tenant support is a v2.0 concern. For now, keep the REPOS/AGENTS config centralized so it's easy to extend later.

- **TypeScript migration** — Would improve DX and catch bugs, but the codebase is small enough (~2000 LOC) that the migration cost outweighs the benefit right now. Revisit at 5000+ LOC.

---

## Phase 2 — Sprint 2: Real-Time Intelligence Platform

> Defined by Ripley (Lead) · March 2026 · Supersedes Phase 1 completion

### Sprint 1 Results (17 issues closed)

Phase 1 delivered architectural consolidation, data integrity, and production hardening:
- Legacy vanilla JS removed (3,381 lines of dead code)
- All React components routed through Express backend
- REPOS/AGENTS configuration centralized
- GitHub token authentication for backend
- Real GitHub Actions usage data (CostTracker)
- 227+ tests, 94%+ coverage (81 component + 30 service + lib tests)
- Zustand store expanded for centralized state
- React Error Boundary, structured JSON logging, bundle size tracking
- Docker deployment validated, CI branch targeting fixed
- Global health score + heartbeat staleness alerts

**The foundation is solid. Phase 2 is the considerable leap.**

### Strategic Direction

The dashboard transforms from a **polling-based status board** into a **real-time intelligence platform**. Three pillars:

1. **Real-Time Streaming** — Replace polling with SSE. Live data, no refresh needed.
2. **Historical Analytics** — Store metrics over time. Trends, velocity, agent productivity.
3. **Proactive Alerting** — Desktop notifications for critical events. Don't wait for someone to look at the screen.

### Theme 6: Real-Time Data Streaming (P1)

**Why:** Polling every 30-60 seconds means the dashboard is always 30-60 seconds stale. The backend already has SSE for log streaming. Extending it to all data channels eliminates lag and makes the dashboard feel alive. This is the single most impactful UX improvement.

| # | Title | Priority | Assignee | Effort |
|---|-------|----------|----------|--------|
| #75 | SSE event bus infrastructure | P1 | Lambert | M |
| #76 | SSE data channels (heartbeat, events, issues, usage) | P1 | Lambert | M |
| #77 | React useSSE hook with Zustand integration | P1 | Dallas | L |
| #78 | SSE connection status indicator in Header | P1 | Dallas | S |

**Dependencies:** #75 → #76 → #77 → #78 (sequential pipeline)

### Theme 7: Historical Analytics (P1)

**Why:** The dashboard shows current state but has no memory. Users can't answer "how are we trending?" or "was last week better than this week?" Persisting metrics enables trend charts, sprint velocity, and agent productivity analysis — transforming the dashboard from a status board into an analytics tool.

| # | Title | Priority | Assignee | Effort |
|---|-------|----------|----------|--------|
| #79 | Metrics persistence layer (SQLite) | P1 | Lambert | L |
| #80 | Agent productivity metrics API | P1 | Lambert | M |
| #81 | Trend charts component (Chart.js) | P1 | Dallas | L |
| #82 | Analytics dashboard view | P1 | Dallas | M |
| #83 | Timeline swimlane view (Gantt-style) | P2 | Dallas | L |

**Dependencies:** #79 → #80, #81, #82; #83 depends on #79 + #80

### Theme 8: Notification & Alerts (P1-P2)

**Why:** The dashboard is passive — you have to look at it to know something's wrong. Desktop notifications make it proactive. When an agent gets blocked or the heartbeat goes stale, you know immediately.

| # | Title | Priority | Assignee | Effort |
|---|-------|----------|----------|--------|
| #84 | Browser notification service with SSE triggers | P1 | Lambert | M |
| #85 | Alert configuration panel | P2 | Dallas | M |
| #86 | Notification history panel with bell badge | P2 | Dallas | S |

**Dependencies:** #84 depends on #75 (SSE event bus); #85/#86 depend on #84

### Theme 9: API & Integration (P2)

**Why:** The backend has 12+ endpoints with zero documentation. Other tools can't integrate. Data is trapped in the dashboard. OpenAPI docs and export endpoints open the platform up.

| # | Title | Priority | Assignee | Effort |
|---|-------|----------|----------|--------|
| #87 | OpenAPI/Swagger documentation | P2 | Lambert | M |
| #88 | Data export endpoints (CSV/JSON) | P2 | Lambert | S |

**Dependencies:** None — documents and extends existing endpoints

### Theme 10: Testing & Quality (P1-P2)

**Why:** Every new feature needs tests. SSE introduces complex connection lifecycle. SQLite introduces data integrity requirements. E2E tests catch the bugs that unit tests miss (blank pages, broken routing, build failures).

| # | Title | Priority | Assignee | Effort |
|---|-------|----------|----------|--------|
| #89 | SSE integration tests | P1 | Kane | M |
| #90 | Historical metrics tests | P1 | Kane | M |
| #91 | E2E smoke tests with Playwright | P1 | Kane | L |
| #92 | Performance benchmarks for SSE and APIs | P2 | Kane | M |

**Dependencies:** #89 follows #75-#77; #90 follows #79-#80; #91 independent

### Sprint 2 Prioritized Backlog

| # | Title | Priority | Theme | Assignee | Dependencies | Effort |
|---|-------|----------|-------|----------|--------------|--------|
| #75 | SSE event bus infrastructure | P1 | 6: Streaming | Lambert | None | M |
| #79 | Metrics persistence layer (SQLite) | P1 | 7: Analytics | Lambert | None | L |
| #91 | E2E smoke tests with Playwright | P1 | 10: Testing | Kane | None | L |
| #76 | SSE data channels | P1 | 6: Streaming | Lambert | #75 | M |
| #80 | Agent productivity API | P1 | 7: Analytics | Lambert | #79 | M |
| #77 | React useSSE hook | P1 | 6: Streaming | Dallas | #75, #76 | L |
| #81 | Trend charts (Chart.js) | P1 | 7: Analytics | Dallas | #79 | L |
| #84 | Browser notification service | P1 | 8: Alerts | Lambert | #75, #76 | M |
| #89 | SSE integration tests | P1 | 10: Testing | Kane | #75, #76, #77 | M |
| #90 | Historical metrics tests | P1 | 10: Testing | Kane | #79, #80 | M |
| #78 | SSE connection status UI | P1 | 6: Streaming | Dallas | #77 | S |
| #82 | Analytics dashboard view | P1 | 7: Analytics | Dallas | #79, #80, #81 | M |
| #83 | Timeline swimlane view | P2 | 7: Analytics | Dallas | #79, #80 | L |
| #85 | Alert configuration panel | P2 | 8: Alerts | Dallas | #84 | M |
| #86 | Notification history panel | P2 | 8: Alerts | Dallas | #84, #85 | S |
| #87 | OpenAPI documentation | P2 | 9: API | Lambert | None | M |
| #88 | Data export endpoints | P2 | 9: API | Lambert | #79 | S |
| #92 | Performance benchmarks | P2 | 10: Testing | Kane | #75, #79 | M |

**Team Balance:** Lambert: 7 issues (backend infrastructure) · Dallas: 7 issues (frontend features) · Kane: 4 issues (quality & testing)

**Effort Key:** XS (<1h), S (1-3h), M (3-8h), L (8-16h)

---

## Future Vision (6-Month Horizon)

### Phase 1: Foundation ✅ COMPLETE — Sprint 1
Consolidated to single React architecture, routed all data through Express backend with GitHub authentication. Mock data eliminated. Single source of truth for configuration. 17 issues closed. **Outcome:** Dashboard shows real data reliably.

### Phase 2: Real-Time Intelligence 🔄 IN PROGRESS — Sprint 2
SSE streaming, historical metrics with SQLite persistence, trend charts with Chart.js, browser notifications, and E2E testing with Playwright. 18 issues defined. **Outcome:** Dashboard is live, has memory, and is proactive.

### Phase 3: Cross-Org Intelligence (Future)
Aggregate data across FFS squads to show organizational health. Multi-squad support, sprint velocity comparisons, cross-repo dependency tracking, cost trends over time, agent utilization patterns. **Outcome:** Dashboard becomes an organizational intelligence tool.

### Phase 4: Platform (Future)
REST API documentation, webhook integrations, Slack/Discord alerts, PWA support, offline capability. **Outcome:** Dashboard becomes a platform that other tools plug into.

---

## Appendix: Issue Disposition

### Sprint 1 (Closed)
| Issue | Title | Status |
|-------|-------|--------|
| #34 | Strategic roadmap | ✅ Closed |
| #35 | Remove legacy vanilla JS | ✅ Closed |
| #36 | Route React through Express | ✅ Closed |
| #37 | Centralize REPOS/AGENTS config | ✅ Closed |
| #38 | Fix CI branch targeting | ✅ Closed |
| #39 | GitHub token authentication | ✅ Closed |
| #41, #42, #43 | Real data integration | ✅ Closed |
| #44, #45 | Health score + staleness alerts | ✅ Closed |
| #48, #49 | Component + service tests | ✅ Closed |
| #50 | Zustand store expansion | ✅ Closed |
| #51 | React Error Boundary | ✅ Closed |
| #54 | Structured JSON logging | ✅ Closed |
| #55 | Bundle size tracking | ✅ Closed |
| #56 | Docker deployment | ✅ Closed |

### Pre-Sprint (Legacy)
| Issue | Title | Status | Recommendation |
|-------|-------|--------|----------------|
| #14 | Round timeline filter | Open/Legacy | Superseded by React redesign. Close. |
| #5 | GitHub Actions status | Open/Legacy | Covered by CostTracker. Close. |
| #3 | Agent activity timeline | Open/Legacy | Covered by ActivityFeed.jsx. Close. |
| #2 | Log viewer improvements | Open/Legacy | Legacy vanilla JS removed. Close. |
| #1 | Heartbeat reader improvements | Open/Legacy | Covered by usePolling + Header. Close. |

---

*This roadmap is a living document. Review quarterly or after major milestones. Update issue references as work is created and completed.*

*— Ripley, Lead · "Every shortcut has a cost."*
