import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../logger.js', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

import {
  checkAgentBlocked,
  checkHeartbeatStale,
  checkBuildFailed,
  checkRateLimitWarning,
  checkIssueSpike,
  checkSprintMilestone,
  SEVERITY,
  RULES,
} from '../notification-rules.js'

describe('SEVERITY', () => {
  it('exports expected severity levels', () => {
    expect(SEVERITY.CRITICAL).toBe('critical')
    expect(SEVERITY.WARNING).toBe('warning')
    expect(SEVERITY.INFO).toBe('info')
    expect(SEVERITY.SUCCESS).toBe('success')
  })
})

describe('checkAgentBlocked', () => {
  it('returns empty for null inputs', () => {
    expect(checkAgentBlocked(null, null)).toEqual([])
    expect(checkAgentBlocked([], null)).toEqual([])
  })

  it('returns empty when no new blocked issues', () => {
    const issues = [
      { repo: 'flora', number: 1, state: 'open', labels: ['blocked-by:api'], title: 'Test' },
    ]
    expect(checkAgentBlocked(issues, issues)).toEqual([])
  })

  it('detects newly blocked issue', () => {
    const prev = [
      { repo: 'flora', number: 1, state: 'open', labels: ['squad:brock'], title: 'Test' },
    ]
    const current = [
      { repo: 'flora', number: 1, state: 'open', labels: ['squad:brock', 'blocked-by:api'], title: 'Fix API', url: 'https://example.com/1' },
    ]
    const result = checkAgentBlocked(current, prev)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('agent-blocked')
    expect(result[0].severity).toBe('warning')
    expect(result[0].body).toContain('brock')
    expect(result[0].body).toContain('#1')
    expect(result[0].link).toBe('https://example.com/1')
  })

  it('skips closed issues', () => {
    const prev = []
    const current = [
      { repo: 'flora', number: 1, state: 'closed', labels: ['blocked-by:api'], title: 'Done' },
    ]
    expect(checkAgentBlocked(current, prev)).toEqual([])
  })

  it('uses Unknown when no squad label', () => {
    const prev = []
    const current = [
      { repo: 'flora', number: 1, state: 'open', labels: ['blocked-by:api'], title: 'Test' },
    ]
    const result = checkAgentBlocked(current, prev)
    expect(result[0].body).toContain('Unknown')
  })
})

describe('checkHeartbeatStale', () => {
  it('returns empty for null heartbeat', () => {
    expect(checkHeartbeatStale(null, null)).toEqual([])
    expect(checkHeartbeatStale({}, null)).toEqual([])
  })

  it('returns empty when heartbeat is fresh', () => {
    const hb = { timestamp: new Date().toISOString() }
    expect(checkHeartbeatStale(hb, null)).toEqual([])
  })

  it('fires when heartbeat exceeds threshold', () => {
    const staleTime = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const current = { timestamp: staleTime }
    const result = checkHeartbeatStale(current, null)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('heartbeat-stale')
    expect(result[0].severity).toBe('critical')
    expect(result[0].body).toMatch(/stale for \d+m/)
  })

  it('does not re-fire if previous was already stale', () => {
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const current = { timestamp: staleTime }
    const previous = { timestamp: staleTime }
    expect(checkHeartbeatStale(current, previous)).toEqual([])
  })

  it('respects custom threshold', () => {
    const age = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const current = { timestamp: age }
    // 1-minute threshold: should fire
    expect(checkHeartbeatStale(current, null, 60_000)).toHaveLength(1)
    // 10-minute threshold: should not fire
    expect(checkHeartbeatStale(current, null, 10 * 60_000)).toEqual([])
  })
})

describe('checkBuildFailed', () => {
  it('returns empty for null events', () => {
    expect(checkBuildFailed(null, null)).toEqual([])
  })

  it('returns empty for non-failure events', () => {
    const events = [
      { id: '1', type: 'PushEvent', payload: {} },
    ]
    expect(checkBuildFailed(events, [])).toEqual([])
  })

  it('detects new build failure', () => {
    const events = [
      {
        id: 'wf-1',
        type: 'WorkflowRunEvent',
        repo: 'flora',
        payload: {
          workflow_run: {
            conclusion: 'failure',
            name: 'CI',
            html_url: 'https://example.com/run/1',
          },
        },
      },
    ]
    const result = checkBuildFailed(events, [])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('build-failed')
    expect(result[0].severity).toBe('critical')
    expect(result[0].body).toContain('flora')
    expect(result[0].link).toBe('https://example.com/run/1')
  })

  it('skips already-seen events', () => {
    const events = [
      {
        id: 'wf-1',
        type: 'WorkflowRunEvent',
        repo: 'flora',
        payload: { workflow_run: { conclusion: 'failure', name: 'CI' } },
      },
    ]
    expect(checkBuildFailed(events, events)).toEqual([])
  })
})

describe('checkRateLimitWarning', () => {
  it('returns empty for null info', () => {
    expect(checkRateLimitWarning(null)).toEqual([])
    expect(checkRateLimitWarning({})).toEqual([])
  })

  it('returns empty when above threshold', () => {
    expect(checkRateLimitWarning({ remaining: 500, limit: 5000 })).toEqual([])
  })

  it('fires when below threshold', () => {
    const result = checkRateLimitWarning({ remaining: 50, limit: 5000 })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('rate-limit-warning')
    expect(result[0].severity).toBe('warning')
    expect(result[0].body).toContain('50')
  })

  it('respects custom threshold', () => {
    expect(checkRateLimitWarning({ remaining: 150 }, 200)).toHaveLength(1)
    expect(checkRateLimitWarning({ remaining: 250 }, 200)).toEqual([])
  })
})

describe('checkIssueSpike', () => {
  it('returns empty for null issues', () => {
    expect(checkIssueSpike(null, null)).toEqual([])
  })

  it('returns empty when few new issues', () => {
    const issues = [
      { repo: 'flora', number: 1, createdAt: new Date().toISOString() },
    ]
    expect(checkIssueSpike(issues, [])).toEqual([])
  })

  it('fires when issue count exceeds threshold', () => {
    const now = new Date().toISOString()
    const current = [
      { repo: 'flora', number: 1, repoLabel: 'Flora', createdAt: now },
      { repo: 'flora', number: 2, repoLabel: 'Flora', createdAt: now },
      { repo: 'flora', number: 3, repoLabel: 'Flora', createdAt: now },
      { repo: 'flora', number: 4, repoLabel: 'Flora', createdAt: now },
    ]
    const result = checkIssueSpike(current, [])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('issue-spike')
    expect(result[0].severity).toBe('info')
    expect(result[0].body).toContain('4')
    expect(result[0].body).toContain('Flora')
  })

  it('ignores already-existing issues', () => {
    const now = new Date().toISOString()
    const issues = [
      { repo: 'flora', number: 1, createdAt: now },
      { repo: 'flora', number: 2, createdAt: now },
      { repo: 'flora', number: 3, createdAt: now },
      { repo: 'flora', number: 4, createdAt: now },
    ]
    expect(checkIssueSpike(issues, issues)).toEqual([])
  })

  it('ignores issues outside time window', () => {
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const current = [
      { repo: 'flora', number: 1, createdAt: oldTime },
      { repo: 'flora', number: 2, createdAt: oldTime },
      { repo: 'flora', number: 3, createdAt: oldTime },
      { repo: 'flora', number: 4, createdAt: oldTime },
    ]
    expect(checkIssueSpike(current, [])).toEqual([])
  })
})

describe('checkSprintMilestone', () => {
  it('returns empty for null issues', () => {
    expect(checkSprintMilestone(null, null)).toEqual([])
  })

  it('fires when milestone threshold is crossed', () => {
    const today = new Date().toISOString().slice(0, 10)
    const current = Array.from({ length: 5 }, (_, i) => ({
      repo: 'flora',
      number: i + 1,
      state: 'closed',
      updatedAt: `${today}T12:00:00.000Z`,
    }))
    const previous = Array.from({ length: 4 }, (_, i) => ({
      repo: 'flora',
      number: i + 1,
      state: 'closed',
      updatedAt: `${today}T12:00:00.000Z`,
    }))
    const result = checkSprintMilestone(current, previous)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('sprint-milestone')
    expect(result[0].severity).toBe('success')
    expect(result[0].body).toContain('5')
  })

  it('does not fire if milestone already crossed', () => {
    const today = new Date().toISOString().slice(0, 10)
    const issues = Array.from({ length: 6 }, (_, i) => ({
      repo: 'flora',
      number: i + 1,
      state: 'closed',
      updatedAt: `${today}T12:00:00.000Z`,
    }))
    expect(checkSprintMilestone(issues, issues)).toEqual([])
  })
})

describe('RULES', () => {
  it('exports all expected rules', () => {
    expect(RULES).toHaveLength(6)
    const names = RULES.map(r => r.name)
    expect(names).toContain('agent-blocked')
    expect(names).toContain('heartbeat-stale')
    expect(names).toContain('build-failed')
    expect(names).toContain('rate-limit')
    expect(names).toContain('issue-spike')
    expect(names).toContain('sprint-milestone')
  })

  it('each rule has an evaluate function', () => {
    for (const rule of RULES) {
      expect(typeof rule.evaluate).toBe('function')
    }
  })

  it('rules return arrays from evaluate', () => {
    const empty = { heartbeat: null, issues: [], events: [], rateLimit: {} }
    for (const rule of RULES) {
      const result = rule.evaluate(empty, empty)
      expect(Array.isArray(result)).toBe(true)
    }
  })
})
