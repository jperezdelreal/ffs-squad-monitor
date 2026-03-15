# Archived Decisions

Decisions archived from decisions.md on 2026-03-15 (space management).

---

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

### 4. PR Review Patterns & Standards (Ripley Lead - P1) [ARCHIVED 2026-03-15]

**Date:** 2026-03-12  
**Status:** Established  
**Context:** PRs #27, #29, #30 — First formal review session

**Decision 1a: Error Handling Pattern (PR #27)**
- API functions return `{error: true, message}` instead of `null` on failure
- Components check `data?.error` and call dedicated `renderXError()` functions
- Global retry functions exposed as `window.__retryX()` for onclick handlers
- Connection state uses 3-tier model: operational/degraded/offline

**Decision 1b: Test Coverage Standards (PR #29)**
- Minimum 80% coverage enforced via vitest.config.js thresholds
- Tests focus on edge cases (null/undefined, boundaries, cleanup)
- Test organization: `__tests__/` subdirectories next to source files
- CI must run tests + coverage on all PRs

**Decision 1c: Content-Aware Triage Heuristic (PR #30)**
- Issue body ≥100 characters with: acceptance criteria OR checklist OR structured sections OR requirements
- Eliminates manual triage bottleneck for well-defined issues

---

### 5. Error Handling Architecture (Dallas - Frontend) [ARCHIVED 2026-03-15]

**Date:** 2026-03-12  
**Status:** Implemented  
**Issue:** #23

Implemented comprehensive error handling with 3-state connection tracking and component-level retry mechanisms. All components in `src/components/` received error states with retry buttons. Dashboard resilience: stays functional if backend is down.
