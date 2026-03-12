# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

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
