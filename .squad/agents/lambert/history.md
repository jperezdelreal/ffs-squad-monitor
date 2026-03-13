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
