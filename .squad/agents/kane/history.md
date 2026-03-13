# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

### Testing Infrastructure (Issue #22 - 2026-03-12)
- **Vitest Configuration:** Established test infrastructure using Vitest 4.1.0 with happy-dom environment for DOM testing
- **Coverage Targets:** Achieved 97.61% coverage on src/lib/ modules (util, scheduler, api) - exceeding 80% requirement
- **Test Organization:** Created __tests__ subdirectories next to source files (e.g., src/lib/__tests__/)
- **Edge Case Focus:** Prioritized testing edge cases like null/undefined handling, boundary conditions, timer cleanup, and error scenarios
- **Module State Management:** API module maintains internal state (connection status, listeners) that persists across tests - used module reset strategy (vi.resetModules) where needed
- **CI Integration:** Added GitHub Actions workflow (.github/workflows/test.yml) for automated testing on PRs and main pushes
- **Test Scripts:** npm test (run once), npm run test:watch (watch mode), npm run test:coverage (coverage report)
- **Coverage Exclusions:** Exclude test files and coverage directory from git (.gitignore)

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-12: Issue #19 - Synced squad-triage.yml with Hub content-aware triage fix

**What was fixed:**
- Replaced unconditional `go:needs-research` label application in `.github/workflows/squad-triage.yml` with content-aware heuristic from Hub PR #191
- The old workflow blindly applied `go:needs-research` to every triaged issue, regardless of issue quality

**Content-aware heuristic logic:**
```javascript
// Analyze issue body for quality indicators
const body = issue.body || '';
const bodyLength = body.trim().length;
const hasAcceptanceCriteria = /acceptance\s+criteria/i.test(body);
const hasChecklist = /- \[ \]/.test(body);
const hasStructuredSections = /^##\s+.+/m.test(body);
const hasRequirements = /requirements/i.test(body);

// Well-defined = 100+ chars + quality indicator
const isWellDefined = bodyLength >= 100 && (hasAcceptanceCriteria || hasChecklist || hasStructuredSections || hasRequirements);
const triageLabel = isWellDefined ? 'go:ready' : 'go:needs-research';
```

**Key insight:** Issues with acceptance criteria, checklists, structured sections, or requirements (100+ chars) are considered "go:ready". Others get "go:needs-research" for clarification.

**Files modified:**
- `.github/workflows/squad-triage.yml` (lines 202-217)

**PR:** #27 (branch: squad/23-error-handling)
