# Squad Decisions

## Active Decisions

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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
