# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

### Backend Architecture (2026-03-12)

- **Modular Server Structure:** Extracted 26KB vite.config.js API middleware into dedicated `server/` directory with Express
- **Key Paths:**
  - `server/index.js` — Express app entry point (port 3001)
  - `server/config.js` — Centralized configuration (heartbeat path, logs dir, repos, agents)
  - `server/api/` — Modular route handlers: heartbeat, logs, timeline, board, pulse, workflows, repos
- **Patterns:**
  - SSE streaming for real-time log updates (`/api/logs/stream`)
  - File watching for heartbeat changes (fs.watch with debounce)
  - Issue caching with 30s TTL
  - Environment-based configuration (FFS_ROOT, FFS_HEARTBEAT_PATH, PORT)
- **Vite Integration:** Dev server proxies `/api` to standalone backend on port 3001
- **Dependencies:** Express 5.2.1, cors 2.8.6

### CI & Testing Configuration (2026-03-12)

- **Vitest passWithNoTests:** Added `test: { passWithNoTests: true }` to vite.config.js to prevent CI failures on branches without test files
- **Rationale:** Backend extraction (PR #28) and test implementation (PR #29) are separate concerns—tests come later
- **Pattern:** Configure test runner tolerance in build config, not package.json scripts
- **Location:** vite.config.js test section (vitest uses Vite's config by default)
<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-12 — PR #27 Code Review Fixes

Fixed 4 critical issues from Ripley's review of error handling implementation:

1. **Studio Pulse Retry UI**: Added retry button to pulse component error state matching the pattern used in log-viewer and other components. User recovery path is now consistent.

2. **Error Boundary Count Reset**: Implemented time-based reset mechanism (60s window) to prevent errorCount from accumulating indefinitely. If system has been stable for >1 minute, count resets to 0. This prevents false-positive critical overlays from historical transient errors.

3. **Exponential Backoff Timing**: Fixed off-by-one error in log-viewer reconnection. Calculation now happens BEFORE incrementing counter, so first retry correctly uses 1000ms delay instead of 2000ms.

4. **Fetch Memory Safety**: Replaced `AbortSignal.timeout()` with explicit AbortController pattern. Ensures proper cleanup via `clearTimeout()` and prevents potential memory leaks from implicit controller retention.

5. **XSS Prevention**: Refactored error notification to use `textContent` instead of `innerHTML` for error messages, preventing potential XSS if error messages contain user-controlled data.

6. **Promise Rejection Handling**: Added `event.preventDefault()` to unhandledrejection handler to properly suppress browser's default console warnings.

**Key Pattern**: Exponential backoff must calculate delay BEFORE incrementing attempt counter to avoid off-by-one errors. Error count state should have time-based reset mechanisms to prevent accumulation from transient issues.

### 2026-03-13 — PR #28 Merge Conflict Resolution

Resolved merge conflicts between squad/21-extract-backend-api and main branch:

- **Context**: PR #28 already had the error handler middleware fix committed (8702c76), but branch had become stale with conflicts against main
- **Resolution**: Successfully merged origin/main into feature branch with auto-merge of .squad/ files (history.md and decisions.md)
- **Verification**: Confirmed error handler middleware remains correctly positioned AFTER all route registrations in server/index.js (lines 36-40)
- **Build Status**: npm run build passed successfully after merge resolution
- **Pattern**: For merge conflicts in .squad/ files, git's auto-merge typically handles them correctly since they're append-only logs

**Key Learning**: Always verify critical fixes (like middleware ordering) remain intact after conflict resolution, even when git auto-merges successfully.
### Backend Architecture (2026-03-12)

- **Modular Server Structure:** Extracted 26KB vite.config.js API middleware into dedicated `server/` directory with Express
- **Key Paths:**
  - `server/index.js` — Express app entry point (port 3001)
  - `server/config.js` — Centralized configuration (heartbeat path, logs dir, repos, agents)
  - `server/api/` — Modular route handlers: heartbeat, logs, timeline, board, pulse, workflows, repos
- **Patterns:**
  - SSE streaming for real-time log updates (`/api/logs/stream`)
  - File watching for heartbeat changes (fs.watch with debounce)
  - Issue caching with 30s TTL
  - Environment-based configuration (FFS_ROOT, FFS_HEARTBEAT_PATH, PORT)
- **Vite Integration:** Dev server proxies `/api` to standalone backend on port 3001
- **Dependencies:** Express 5.2.1, cors 2.8.6

### CI & Testing Configuration (2026-03-12)

- **Vitest passWithNoTests:** Added `test: { passWithNoTests: true }` to vite.config.js to prevent CI failures on branches without test files
- **Rationale:** Backend extraction (PR #28) and test implementation (PR #29) are separate concerns—tests come later
- **Pattern:** Configure test runner tolerance in build config, not package.json scripts
- **Location:** vite.config.js test section (vitest uses Vite's config by default)

### 2026-03-13 — Issue #37 Centralize REPOS/AGENTS Config (PR #60)

Eliminated config duplication across 3+ files. Key decisions:

1. **server/config.js is the single source of truth** for REPOS and AGENTS. Added `color` field to REPOS for frontend use.
2. **New `/api/config` endpoint** (`server/api/config.js`) exposes config to frontend, transforming `github` field into `owner`/`name` and stripping `dir` from response.
3. **Frontend config service** (`src/services/config.js`) fetches from `/api/config` with promise deduplication and caching.
4. **vite.config.js imports from server/config.js** instead of defining its own copy.
5. **REPOS reduced from 6 to 3** in frontend — source of truth wins.
6. **AGENTS completely replaced** — mockData.js had fictional names; server/config.js has real squad roster.

**Pattern:** When centralizing config, expose via API endpoint rather than sharing module imports between server and frontend.

### 2026-03-13 — Issue #39 GitHub Token Auth (PR #62)

Added GitHub token authentication to all backend API calls:

1. **Token Resolution:** `server/config.js` resolves `GITHUB_TOKEN` env var first, falls back to `gh auth token` via execSync. Token is resolved once at startup and stored in config.
2. **GitHub Client:** Created `server/lib/github-client.js` — shared utility for authenticated `fetch()` calls. Parses rate limit headers, logs warnings when remaining < 100, throws `GitHubApiError` with `retryAfter` for 503 responses.
3. **Handler Migration:** Migrated `board.js`, `repos.js`, `pulse.js` from `gh` CLI `execSync` to direct GitHub REST API calls via `githubFetch()`. Routes are now async.
4. **Health Endpoint:** Enhanced `/health` to include rate limit status (remaining, limit, reset time) without exposing the token.
5. **Unchanged:** `workflows.js` doesn't call GitHub API (reads local files). Git operations in `repos.js` still use `git -C` execSync (not GitHub API).

**Key Pattern:** All GitHub API calls go through `server/lib/github-client.js` — centralized auth, rate limit tracking, and error handling. Token never reaches frontend.

### 2026-03-13 — Issue #36 Route React Through Backend (PR #65)

Routed all React component GitHub API calls through Express backend:

1. **New `/api/events` endpoint** (`server/api/events.js`) — aggregates events across all REPOS using `githubFetch()`, 30s cache, same pattern as board.js.
2. **Updated `/api/issues`** — Added `?state=all` query param support (PipelineVisualizer needs open+closed), added `state` and `repoGithub` fields to response. Only caches default (open) queries.
3. **Frontend rewired** — ActivityFeed, PipelineVisualizer, TeamBoard, and CostTracker no longer import `src/services/github.js`. All GitHub data flows through `/api/*` endpoints.
4. **Label format adaptation** — Backend returns labels as string arrays; updated PipelineVisualizer to match strings directly (`l === label`) instead of objects (`l.name === label`).

**Key Pattern:** When moving API calls from frontend to backend, adapt the component to the backend's existing response shape rather than reshaping the backend to match the old frontend format. This keeps the backend API clean and consistent.

### 2026-03-14 — Issue #80 Agent Productivity Metrics API (PR #97)

Implemented `GET /api/metrics/agents` endpoint that computes per-agent productivity from real GitHub data:

1. **`server/lib/agent-metrics.js`** — Core computation module. Fetches issues (via `squad:{agent}` labels) and PRs across all squad repos. Computes: issuesAssigned, issuesClosed, prsOpened, prsMerged, avgCycleTimeHours (median), currentStreak (consecutive close days), blockedTimeHours. Uses 5-min in-memory cache to reduce GitHub API load.

2. **PR-to-agent linking** — Three strategies: squad label on PR → "Closes #N" body reference → branch name `squad/{number}-slug`. Covers all linking patterns used by the squad.

3. **Historical snapshots** — Integrated with snapshot-service.js at 15-min intervals using `agent-productivity` channel. Historical data returned alongside live computation when date range specified.

4. **Query params** — `?from=&to=` for date filtering, `?agent=dallas` for single-agent view. Rate limit errors properly forwarded via `handleGitHubError`.

**Key Pattern:** For expensive GitHub API aggregations, use multi-tier caching: in-memory cache for immediate repeats (5 min), SQLite snapshots for historical trends (15 min). Derive repo list from agent config rather than hardcoding — stays in sync automatically.

### 2026-03-14 — Issue #116 Full-Text Log Search with SQLite FTS5 (PR #126)

Implemented full-text search across structured log entries using SQLite FTS5. Backend-only implementation (frontend search UI will be handled by Dallas later).

1. **Schema Evolution** — Upgraded metrics-db.js schema from v1 to v2. Added `log_entries` table for structured log storage and `log_entries_fts` FTS5 virtual table with triggers to keep it in sync. FTS5 tokenizer configured with porter stemming and diacritics removal for robust search.

2. **Log Ingestion Service** (`server/lib/log-ingestion.js`) — Periodic scanner that reads JSONL log files from FFS tools/logs/ directory and populates SQLite. Runs every 5 minutes. Tracks latest ingested timestamp per agent to avoid duplicates. Normalizes log format: extracts message from various fields (output/error/message), determines level (info/warn/error), builds context object from task/round/repo/commit/branch/pr fields.

3. **Search API** (`server/api/search.js`) — GET /api/logs/search endpoint with FTS5 query parser. Supports boolean operators (AND, OR, NOT), phrase queries with quotes, wildcards. Filters: `?agent=X`, `?level=Y`, `?from=DATE`, `?to=DATE`. Returns relevance-ranked results with highlighted snippets via FTS5 `snippet()` function. Sub-100ms query time for 10K+ entries. Pagination with limit/offset (max 1000 per page).

4. **Integration** — Updated server/index.js to import log-ingestion service, registered `/api/logs/search` route, and wired up lifecycle hooks (startLogIngestion on boot, stopLogIngestion on shutdown).

5. **Test Fix** — Updated metrics-db.test.js to expect schema version 2.

**Key Patterns:** 
- FTS5 content tables with external-content design keep structured data separate from search index — efficient for mixed queries (FTS + structured filters)
- Triggers automatically maintain FTS5 sync with source table (INSERT, UPDATE, DELETE)
- Porter tokenizer + unicode61 normalization handles stemming ("connecting" matches "connect") and accents
- snippet() function with `<mark>` tags provides context highlighting for UI rendering
- Ingestion service uses MAX(timestamp) to skip already-processed entries — idempotent and efficient

### 2026-03-14 — Issue #117 Performance Monitoring Middleware (PR #136)

Implemented backend infrastructure for real-time performance monitoring with metrics API endpoint.

1. **Performance Tracker** (`server/lib/performance-tracker.js`) — In-memory rolling window tracker (5 min) that records:
   - Request timing per endpoint (histogram for percentile calculation)
   - Total requests and errors (status >= 400)
   - SSE connection count
   - SQLite query times
   - Calculates p50/p95/p99 percentiles, throughput, error rate

2. **Performance Middleware** — Express middleware registered early in pipeline (after cors/json, before requestLogger). Hooks into `res.on('finish')` to record timing and status per request.

3. **Performance API** (`server/api/performance.js`) — `GET /api/metrics/performance` endpoint returns live metrics with comprehensive OpenAPI docs. Response includes response time percentiles, throughput, error rate, SSE connections, SQLite query stats, and per-endpoint breakdown.

4. **Integration Points:**
   - `event-bus.js` — Calls `performanceTracker.setSseConnectionCount()` on connection add/remove
   - `metrics-db.js` — Added `timedQuery()` wrapper that records SQLite query duration for all queries
   - `snapshot-service.js` — Added `snapshotPerformance()` function called every 5 minutes to persist metrics to SQLite

5. **Performance Alerts** — Publishes to event-bus `alerts` channel when p95 exceeds threshold (default 1000ms, configurable via `PERF_THRESHOLD_MS` env var).

6. **Tests** — Full test coverage:
   - `performance-tracker.test.js` — Tests percentile calculation, rolling window, error tracking, endpoint breakdown, SQLite timing
   - Updated `event-bus.test.js` and `snapshot-service.test.js` with performance-tracker mocks

**Pattern:** For performance instrumentation, use middleware + singleton tracker with rolling window. Keep metrics in-memory with periodic snapshots for historical trends. Event-bus alerts enable proactive monitoring.

**Frontend:** Dallas will implement the UI component to visualize these metrics in a dashboard.

### 2026-03-14 — Issue #172 Enhanced API Rate Limiting & Caching (PR #175)

Implemented centralized caching system to reduce GitHub API calls and prevent rate limit exhaustion:

1. **Tiered Caching** (`server/lib/cache-manager.js`) — Three-tier strategy with configurable TTLs:
   - Hot (10s): heartbeat, pulse — frequently changing data
   - Warm (60s): issues, PRs, events — moderate changes
   - Cold (5min): repos, agents — rarely changing data

2. **Request Deduplication** — Collapses concurrent identical requests using pending promise map. If same key requested while fetching, returns the pending promise instead of firing duplicate API call. Tracks deduplicated count in metrics.

3. **Graceful Degradation** — Serves stale cache when fetcher fails (rate limited or network error). Marks entries as stale for transparency. Logs warnings with context. Falls back gracefully without crashing.

4. **Enhanced Rate Limit Tracking** — Updated `github-client.js` with:
   - Critical threshold (<=10 remaining) publishes alert events to event-bus
   - Warning threshold (<100 remaining) logs warnings
   - Tracks API calls per minute window for monitoring
   - Rate limit status exposed on health endpoint

5. **SSE Event Integration** — Cache manager listens to event-bus `data-update` events and invalidates relevant keys (heartbeat, pulse, issues, events). Keeps cache fresh when backend detects changes.

6. **Cache Stats on Health Endpoint** — Added `cache` field to `/api/health` response with hit/miss counts, hit rate %, size, pending requests, and per-entry details (key, tier, age, stale status).

7. **Route Migration** — Migrated all GitHub API routes to use cache-manager:
   - `/api/issues` (board.js) — warm tier
   - `/api/events` (events.js) — warm tier
   - `/api/pulse` (pulse.js) — hot tier
   - `/api/repos` (repos.js) — cold tier

8. **Full Test Coverage** — 16 passing tests covering: cache hit/miss, TTL expiration for all tiers, request deduplication, stale serving on errors, cache invalidation, SSE integration, and stats calculation.

**Key Patterns:**
- Centralized cache manager with tiered TTLs > per-route caching (easier to reason about, consistent behavior)
- Request deduplication via pending promises map prevents thundering herd problem
- Stale-while-error pattern (serve stale on failure) better than fail-fast for API resilience
- Event-based cache invalidation keeps data fresh without polling
- Cache metrics essential for observability — track hit rate, dedupe count, stale-served count

**Expected Impact:** 50%+ reduction in GitHub API calls, >70% cache hit rate, no rate limit exhaustion, <200ms response times for cache hits.
