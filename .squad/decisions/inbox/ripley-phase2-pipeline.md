# Decision: Phase 2 — Real-Time Intelligence Platform

**Author:** Ripley (Lead)  
**Date:** 2026-03-14  
**Status:** PROPOSED  
**Tier:** T1 (Lead authority)

---

## Context

Sprint 1 closed 17 issues across 5 themes — architecture consolidation, data integrity, operational intelligence, developer experience, and production hardening. The foundation is solid: single React architecture, authenticated Express backend, 227+ tests at 94%+ coverage, Zustand store, Docker deployment, CI with bundle tracking.

The user directive was "un salto considerable" — a considerable leap. Not incremental polish. The next evolution.

## Decision

Phase 2 (Sprint 2) focuses on three strategic pillars that transform the dashboard from a polling-based status board into a **real-time intelligence platform**:

### Pillar 1: Real-Time Streaming (SSE)
Replace 30-60s polling intervals with Server-Sent Events. The backend already has SSE infrastructure for log streaming — we extend it to all data channels. Live heartbeat, live events, live issue state changes. No refresh needed.

**Rationale:** This is the highest-impact UX improvement. A monitoring dashboard that's always 30-60 seconds stale defeats its purpose. SSE is the right technology (not WebSockets) because we're read-only — server pushes to client, never the reverse.

### Pillar 2: Historical Analytics
Add SQLite persistence to store metrics over time. Enable trend charts (Chart.js), sprint velocity tracking, and agent productivity analysis. New "Analytics" dashboard view.

**Rationale:** The dashboard shows "what's happening now" but can't answer "how are we trending?" or "was last week better?" Memory transforms it from a status board into an analytics tool. SQLite is the right choice — zero-config, embedded, no external database to manage.

### Pillar 3: Proactive Alerting
Desktop browser notifications for critical events (agent blocked, heartbeat stale, build failed). Configurable thresholds. Notification history panel.

**Rationale:** A monitoring tool that only works when you're looking at it is half a monitoring tool. Notifications make it proactive — you know something's wrong even if the tab is in the background.

## Issues Created

18 issues (#75-#92) across 5 themes:
- **Theme 6 (Streaming):** #75, #76, #77, #78 — Lambert + Dallas
- **Theme 7 (Analytics):** #79, #80, #81, #82, #83 — Lambert + Dallas
- **Theme 8 (Alerts):** #84, #85, #86 — Lambert + Dallas
- **Theme 9 (API):** #87, #88 — Lambert
- **Theme 10 (Testing):** #89, #90, #91, #92 — Kane

Team balance: Lambert 7, Dallas 7, Kane 4.

## What We're NOT Doing

- **Multi-squad support** — still premature. Config is centralized; we'll extend when there's demand.
- **WebSockets** — SSE covers 100% of our use case (server→client push). WebSockets add protocol complexity for zero benefit in a read-only dashboard.
- **TypeScript migration** — codebase is ~3000 LOC now. Migration cost still outweighs benefit. Revisit at 5000+ LOC.
- **Plugin architecture** — 5 views isn't enough to justify extensibility infrastructure. Build specific features first.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SSE connection reliability in corporate proxies | Medium | Dashboard falls back to polling | Built-in polling fallback after 3 SSE failures |
| SQLite file locking under concurrent access | Low | Data loss on write conflict | better-sqlite3 uses WAL mode by default (concurrent reads + single writer) |
| Chart.js bundle size impact | Medium | Page load regression | Tree-shake unused Chart.js components; track via existing bundle size CI |
| Playwright E2E tests flaky in CI | Medium | Developer friction | 1 retry + failure screenshots + trace on retry |

## Success Metrics

- [ ] Dashboard shows live data updates without manual refresh
- [ ] Users can see 7-day and 30-day trend charts for key metrics
- [ ] Desktop notifications fire for blocked agents and stale heartbeat
- [ ] E2E tests catch full-page rendering failures
- [ ] All new modules have ≥80% test coverage
- [ ] API documentation available at /api/docs

---

*"The foundation was the hard part. Now we build the thing people actually use." — Ripley*
