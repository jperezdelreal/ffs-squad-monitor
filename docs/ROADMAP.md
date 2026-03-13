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

## Future Vision (6-Month Horizon)

### Phase 1: Foundation (Weeks 1-4) — Themes 1 & 2
Consolidate to single React architecture, route all data through Express backend with GitHub authentication. Kill mock data. Establish single source of truth for configuration. **Outcome:** Dashboard shows real data reliably.

### Phase 2: Intelligence (Weeks 5-8) — Themes 3 & 4
Add health scoring, alerting, and anomaly detection. Expand test coverage to components. Centralize state management. **Outcome:** Dashboard helps users make operational decisions.

### Phase 3: Hardening (Weeks 9-12) — Theme 5
Structured logging, enhanced health checks, Docker deployment, bundle size tracking, performance monitoring. **Outcome:** Dashboard runs reliably in production without babysitting.

### Phase 4: Real-Time (Weeks 13-16) — Technical Bet
Migrate from polling to SSE for all data feeds. The backend already has SSE infrastructure (log streaming). Extend it to heartbeat, agents, and pipeline updates. **Outcome:** Dashboard shows live data with sub-second latency.

### Phase 5: Cross-Org Intelligence (Weeks 17-24) — Future
Aggregate data across FFS squads to show organizational health. Sprint velocity, cross-repo dependency tracking, cost trends over time, agent utilization patterns. **Outcome:** Dashboard becomes an organizational intelligence tool, not just a status board.

---

## Appendix: Existing Issue Disposition

| Issue | Title | Status | Recommendation |
|-------|-------|--------|----------------|
| #34 | Define next roadmap | Open | This document closes it |
| #14 | Round timeline filter (show last N) | Open/Legacy | Superseded by React redesign. Close if timeline.js is removed |
| #5 | GitHub Actions status integration | Open/Legacy | Partially covered by PipelineVisualizer. Revisit in Theme 3 |
| #3 | Agent activity timeline | Open/Legacy | Covered by ActivityFeed.jsx. Close |
| #2 | Log viewer improvements | Open/Legacy | Log viewer is legacy vanilla JS. Defer until React port |
| #1 | Heartbeat reader improvements | Open/Legacy | Covered by usePolling + Header. Close or redefine for React |

---

*This roadmap is a living document. Review quarterly or after major milestones. Update issue references as work is created and completed.*

*— Ripley, Lead · "Every shortcut has a cost."*
