

---

## Project Lifecycle

> Standard FFS lifecycle. Every ceremony produces GitHub issues as output.

### Terminology

- **Design doc** — The project's source of truth. GDD for games, PRD for tools, SPEC for infrastructure. The lifecycle doesn't care which.
- **Sprint** — A batch of issues representing one increment of progress. **Sprints end when their issues are closed, not on a calendar date.**

---

### Sprint Planning

| Field | Value |
|-------|-------|
| **Trigger** | Auto: all `sprint:N` issues closed, OR first run (kickoff) |
| **Condition** | `project-state.json` has `phase: "sprint-planning"` or doesn't exist yet |
| **Facilitator** | Lead |
| **Participants** | Lead |
| **Time budget** | focused |
| **Enabled** | yes |

**This ceremony replaces Kickoff, Sprint Planning N, and Mid-Project Evaluation.** One ceremony, context-sensitive:

**If first sprint (kickoff):**
1. Read the design doc end-to-end
2. Decompose project into rough sprint count (3-6)
3. Create a `[ROADMAP]` issue with sprint overview
4. Create Sprint 1 implementation issues
5. Create `project-state.json` with `phase: "sprinting"`, `sprint: 1`

**If subsequent sprint:**
1. Review what shipped in the last sprint
2. Evaluate project health: are we on track? scope creep? tech debt?
3. Read design doc sections relevant to next sprint
4. Check existing open issues - avoid duplicates
5. Create implementation issues for Sprint N+1
6. If project is mature or founder says ship -> transition to Closeout instead

**Every issue created must have:**
- Clear title and acceptance criteria
- Labels: `squad:{member}`, `priority:p{0-3}`, `sprint:N`
- `go:ready` label (not `go:needs-research` - these are design-doc-derived, fully specified)

**State transition:** `sprint-planning -> sprinting`

---

### Closeout

| Field | Value |
|-------|-------|
| **Trigger** | Manual: founder directive, OR Sprint Planning decides project is mature |
| **Condition** | `project-state.json` has `phase: "closeout"` |
| **Facilitator** | Lead |
| **Participants** | Lead |
| **Time budget** | focused |
| **Enabled** | yes |

**Purpose:** For shipped or mature projects. Evaluate the live project against its design doc and create improvement issues.

**Process:**
1. Evaluate project against design doc - what's missing, what could be better?
2. Check for polish, performance, accessibility, user feedback
3. Create improvement issues (labeled, assigned, `go:ready`)
4. Skill harvest: identify reusable patterns worth promoting to hub skills

**Re-trigger:** On meaningful events - founder directive, user feedback, agent observation during routine work. Not on a fixed timer.

**Archive signal:** Founder closes the `[ROADMAP]` issue. That stops the closeout loop.

**State transition:** `closeout -> closeout` (loops) or -> archived (roadmap issue closed)