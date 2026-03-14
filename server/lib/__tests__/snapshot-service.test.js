import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../logger.js', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../metrics-db.js', () => ({
  insertSnapshot: vi.fn(),
  getLatestSnapshotHash: vi.fn(() => null),
  upsertDailySummary: vi.fn(),
  pruneOldSnapshots: vi.fn(),
  querySnapshots: vi.fn(() => []),
}))

vi.mock('../github-client.js', () => ({
  githubFetch: vi.fn(),
}))

vi.mock('../agent-metrics.js', () => ({
  snapshotAgentProductivity: vi.fn(),
}))

vi.mock('../../config.js', () => ({
  REPOS: [
    { id: 'flora', github: 'jperezdelreal/flora', color: '#ef4444' },
  ],
  SQUAD_AGENTS: {
    ripley: { role: 'Lead', repo: 'ffs-squad-monitor' },
    dallas: { role: 'Frontend Dev', repo: 'ffs-squad-monitor' },
  },
}))

import {
  startSnapshotService,
  stopSnapshotService,
  snapshotIssues,
  snapshotAgents,
  snapshotActions,
  computeDailySummary,
} from '../snapshot-service.js'

import { insertSnapshot, getLatestSnapshotHash, upsertDailySummary, pruneOldSnapshots, querySnapshots } from '../metrics-db.js'
import { githubFetch } from '../github-client.js'

describe('Snapshot Service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve([]),
    }))
  })

  afterEach(() => {
    stopSnapshotService()
    vi.useRealTimers()
  })

  describe('snapshotIssues', () => {
    it('fetches issues and stores snapshot', async () => {
      githubFetch.mockResolvedValue({
        data: [{ id: 1, title: 'Test' }],
      })
      await snapshotIssues()
      expect(githubFetch).toHaveBeenCalled()
      expect(insertSnapshot).toHaveBeenCalledWith(
        'issues',
        expect.any(String),
        expect.objectContaining({ total: expect.any(Number) }),
        expect.any(String),
      )
    })

    it('skips snapshot when data unchanged (hash dedup)', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      getLatestSnapshotHash.mockReturnValue('matching-hash')
      await snapshotIssues()
      expect(getLatestSnapshotHash).toHaveBeenCalledWith('issues')
    })

    it('handles API error gracefully', async () => {
      githubFetch.mockRejectedValue(new Error('API down'))
      await expect(snapshotIssues()).resolves.not.toThrow()
    })
  })

  describe('snapshotAgents', () => {
    it('creates agent snapshot with configured agents', async () => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 'ripley', status: 'working', currentWork: 'Issue #42' },
        ]),
      }))
      await snapshotAgents()
      expect(insertSnapshot).toHaveBeenCalledWith(
        'agents',
        expect.any(String),
        expect.objectContaining({
          agents: expect.any(Object),
          summary: expect.objectContaining({ total: expect.any(Number) }),
        }),
        expect.any(String),
      )
    })

    it('falls back gracefully when agent API unavailable', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Connection refused')))
      await snapshotAgents()
      expect(insertSnapshot).toHaveBeenCalled()
      const snapshotData = insertSnapshot.mock.calls[0][2]
      expect(snapshotData.agents.ripley.status).toBe('idle')
    })
  })

  describe('snapshotActions', () => {
    it('fetches workflow runs and stores snapshot', async () => {
      githubFetch.mockResolvedValue({
        data: {
          workflow_runs: [{
            created_at: '2026-03-13T10:00:00Z',
            updated_at: '2026-03-13T10:05:00Z',
          }],
        },
      })
      await snapshotActions()
      expect(githubFetch).toHaveBeenCalled()
      expect(insertSnapshot).toHaveBeenCalledWith(
        'actions',
        expect.any(String),
        expect.objectContaining({ totalRuns: expect.any(Number) }),
        expect.any(String),
      )
    })

    it('handles missing workflow_runs key', async () => {
      githubFetch.mockResolvedValue({ data: {} })
      await expect(snapshotActions()).resolves.not.toThrow()
    })

    it('handles API error gracefully', async () => {
      githubFetch.mockRejectedValue(new Error('Rate limited'))
      await expect(snapshotActions()).resolves.not.toThrow()
    })
  })

  describe('computeDailySummary', () => {
    it('computes and stores daily summary', async () => {
      const now = new Date('2026-03-14T12:00:00.000Z')
      vi.setSystemTime(now)
      querySnapshots.mockReturnValue([
        { data: { open: 5 }, timestamp: '2026-03-13T08:00:00.000Z' },
        { data: { open: 7 }, timestamp: '2026-03-13T20:00:00.000Z' },
      ])
      await computeDailySummary()
      expect(querySnapshots).toHaveBeenCalled()
      expect(upsertDailySummary).toHaveBeenCalledWith(
        '2026-03-13',
        expect.any(String),
        expect.objectContaining({
          snapshotCount: 2,
          firstSnapshot: expect.any(Object),
          lastSnapshot: expect.any(Object),
        }),
      )
    })

    it('skips channels with no snapshots', async () => {
      const now = new Date('2026-03-14T12:00:00.000Z')
      vi.setSystemTime(now)
      querySnapshots.mockReturnValue([])
      await computeDailySummary()
      expect(upsertDailySummary).not.toHaveBeenCalled()
    })
  })

  describe('service lifecycle', () => {
    it('starts all interval timers', () => {
      startSnapshotService()
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })

    it('stops all timers on stopSnapshotService', () => {
      startSnapshotService()
      stopSnapshotService()
      vi.clearAllMocks()
      vi.advanceTimersByTime(60 * 60 * 1000)
      expect(insertSnapshot).not.toHaveBeenCalled()
    })

    it('runs initial snapshots after 10s delay', async () => {
      startSnapshotService()
      expect(githubFetch).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(githubFetch).toHaveBeenCalled()
    })
  })
})
