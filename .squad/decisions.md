# Squad Decisions

## Active Decisions

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
