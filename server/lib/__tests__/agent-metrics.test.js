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
  querySnapshots: vi.fn(() => []),
}))

vi.mock('../github-client.js', () => ({
  githubFetch: vi.fn(),
}))

vi.mock('../../config.js', () => ({
  REPOS: [
    { id: 'ffs-squad-monitor', github: 'jperezdelreal/ffs-squad-monitor', color: '#ef4444' },
  ],
  SQUAD_AGENTS: {
    ripley: { emoji: '🏗️', role: 'Lead', color: '#58a6ff', repo: 'ffs-squad-monitor' },
    dallas: { emoji: '⚛️', role: 'Frontend Dev', color: '#bc8cff', repo: 'ffs-squad-monitor' },
    lambert: { emoji: '🔧', role: 'Backend Dev', color: '#f0883e', repo: 'ffs-squad-monitor' },
    kane: { emoji: '🧪', role: 'Tester', color: '#da3633', repo: 'ffs-squad-monitor' },
  },
}))

import {
  computeAgentMetrics,
  snapshotAgentProductivity,
  queryProductivityHistory,
  clearAgentMetricsCache,
} from '../agent-metrics.js'
import { githubFetch } from '../github-client.js'
import { insertSnapshot, getLatestSnapshotHash, querySnapshots } from '../metrics-db.js'

describe('Agent Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAgentMetricsCache()
  })

  describe('computeAgentMetrics', () => {
    it('returns metrics for all configured agents', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      expect(result.agents).toBeTruthy()
      expect(result.agents.ripley).toBeTruthy()
      expect(result.agents.dallas).toBeTruthy()
      expect(result.agents.lambert).toBeTruthy()
      expect(result.agents.kane).toBeTruthy()
      expect(result.generatedAt).toBeTruthy()
    })

    it('agents with zero activity return zero values', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      for (const [, metrics] of Object.entries(result.agents)) {
        expect(metrics.issuesAssigned).toBe(0)
        expect(metrics.issuesClosed).toBe(0)
        expect(metrics.prsOpened).toBe(0)
        expect(metrics.prsMerged).toBe(0)
        expect(metrics.avgCycleTimeHours).toBe(0)
        expect(metrics.currentStreak).toBe(0)
        expect(metrics.blockedTimeHours).toBe(0)
      }
    })

    it('counts assigned issues per agent', async () => {
      githubFetch.mockResolvedValueOnce({
        data: [
          {
            number: 1, state: 'open', created_at: '2026-03-13T10:00:00Z',
            updated_at: '2026-03-13T10:00:00Z',
            labels: [{ name: 'squad' }, { name: 'squad:dallas' }],
          },
          {
            number: 2, state: 'open', created_at: '2026-03-13T10:00:00Z',
            updated_at: '2026-03-13T10:00:00Z',
            labels: [{ name: 'squad' }, { name: 'squad:dallas' }],
          },
          {
            number: 3, state: 'open', created_at: '2026-03-13T10:00:00Z',
            updated_at: '2026-03-13T10:00:00Z',
            labels: [{ name: 'squad' }, { name: 'squad:kane' }],
          },
        ],
      })
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      expect(result.agents.dallas.issuesAssigned).toBe(2)
      expect(result.agents.kane.issuesAssigned).toBe(1)
      expect(result.agents.ripley.issuesAssigned).toBe(0)
    })

    it('calculates average cycle time (median)', async () => {
      const now = new Date()
      const h12ago = new Date(now.getTime() - 12 * 60 * 60 * 1000)
      const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000)
      githubFetch.mockResolvedValueOnce({
        data: [
          {
            number: 1, state: 'closed',
            created_at: h24ago.toISOString(), closed_at: h12ago.toISOString(),
            updated_at: h12ago.toISOString(),
            labels: [{ name: 'squad' }, { name: 'squad:dallas' }],
          },
          {
            number: 2, state: 'closed',
            created_at: h48ago.toISOString(), closed_at: h24ago.toISOString(),
            updated_at: h24ago.toISOString(),
            labels: [{ name: 'squad' }, { name: 'squad:dallas' }],
          },
        ],
      })
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      expect(result.agents.dallas.issuesClosed).toBe(2)
      expect(result.agents.dallas.avgCycleTimeHours).toBeGreaterThan(0)
    })

    it('handles single issue cycle time', async () => {
      const created = new Date('2026-03-13T00:00:00Z')
      const closed = new Date('2026-03-13T06:00:00Z')
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 1, state: 'closed',
          created_at: created.toISOString(), closed_at: closed.toISOString(),
          updated_at: closed.toISOString(),
          labels: [{ name: 'squad' }, { name: 'squad:kane' }],
        }],
      })
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      expect(result.agents.kane.issuesClosed).toBe(1)
      expect(result.agents.kane.avgCycleTimeHours).toBe(6)
    })

    it('calculates blocked time for open blocked issues', async () => {
      const now = new Date()
      const updated = new Date(now.getTime() - 10 * 60 * 60 * 1000)
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 5, state: 'open',
          created_at: '2026-03-10T00:00:00Z',
          updated_at: updated.toISOString(),
          labels: [{ name: 'squad' }, { name: 'squad:lambert' }, { name: 'blocked-by:upstream' }],
        }],
      })
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      expect(result.agents.lambert.blockedTimeHours).toBeGreaterThan(9)
    })

    it('filters by agent', async () => {
      githubFetch.mockResolvedValueOnce({
        data: [
          { number: 1, state: 'open', created_at: '2026-03-13T10:00:00Z', updated_at: '2026-03-13T10:00:00Z', labels: [{ name: 'squad' }, { name: 'squad:dallas' }] },
          { number: 2, state: 'open', created_at: '2026-03-13T10:00:00Z', updated_at: '2026-03-13T10:00:00Z', labels: [{ name: 'squad' }, { name: 'squad:kane' }] },
        ],
      })
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics(null, null, 'dallas')
      expect(result.agents.dallas).toBeTruthy()
      expect(result.agents.kane).toBeUndefined()
    })

    it('filters by date range', async () => {
      githubFetch.mockResolvedValueOnce({
        data: [
          { number: 1, state: 'open', created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-10T10:00:00Z', labels: [{ name: 'squad' }, { name: 'squad:dallas' }] },
          { number: 2, state: 'open', created_at: '2026-03-13T10:00:00Z', updated_at: '2026-03-13T10:00:00Z', labels: [{ name: 'squad' }, { name: 'squad:dallas' }] },
        ],
      })
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics('2026-03-12T00:00:00Z', '2026-03-14T00:00:00Z')
      expect(result.agents.dallas.issuesAssigned).toBe(1)
      expect(result.period.from).toBe('2026-03-12T00:00:00Z')
      expect(result.period.to).toBe('2026-03-14T00:00:00Z')
    })

    it('links PRs to agents via squad labels', async () => {
      // fetchSquadIssues returns <100 items (no pagination)
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 10, state: 'open', created_at: '2026-03-13T10:00:00Z', updated_at: '2026-03-13T10:00:00Z',
          labels: [{ name: 'squad' }, { name: 'squad:dallas' }],
        }],
      })
      // fetchAllPRs returns <100 items (no pagination)
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 50, state: 'closed', created_at: '2026-03-13T10:00:00Z',
          merged_at: '2026-03-13T12:00:00Z',
          labels: [{ name: 'squad:dallas' }],
          body: 'Closes #10', head: { ref: 'squad/10-feature' },
        }],
      })
      const result = await computeAgentMetrics()
      expect(result.agents.dallas.prsOpened).toBe(1)
      expect(result.agents.dallas.prsMerged).toBe(1)
    })

    it('links PRs to agents via Closes #N in body', async () => {
      // fetchSquadIssues
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 20, state: 'closed', created_at: '2026-03-13T00:00:00Z',
          closed_at: '2026-03-13T06:00:00Z', updated_at: '2026-03-13T06:00:00Z',
          labels: [{ name: 'squad' }, { name: 'squad:kane' }],
        }],
      })
      // fetchAllPRs - no squad label, but body has Closes #20
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 55, state: 'closed', created_at: '2026-03-13T01:00:00Z',
          merged_at: '2026-03-13T05:00:00Z',
          labels: [], body: 'Fixes things. Closes #20',
          head: { ref: 'fix/something' },
        }],
      })
      const result = await computeAgentMetrics()
      expect(result.agents.kane.prsOpened).toBe(1)
      expect(result.agents.kane.prsMerged).toBe(1)
    })

    it('links PRs to agents via branch name', async () => {
      // fetchSquadIssues
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 30, state: 'open', created_at: '2026-03-13T10:00:00Z', updated_at: '2026-03-13T10:00:00Z',
          labels: [{ name: 'squad' }, { name: 'squad:lambert' }],
        }],
      })
      // fetchAllPRs - no label/closes but branch is squad/30-*
      githubFetch.mockResolvedValueOnce({
        data: [{
          number: 60, state: 'open', created_at: '2026-03-13T11:00:00Z',
          merged_at: null, labels: [], body: 'Adding a feature',
          head: { ref: 'squad/30-add-feature' },
        }],
      })
      const result = await computeAgentMetrics()
      expect(result.agents.lambert.prsOpened).toBe(1)
      expect(result.agents.lambert.prsMerged).toBe(0)
    })

    it('uses cached result for repeated unfiltered calls', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      const result1 = await computeAgentMetrics()
      vi.clearAllMocks()
      const result2 = await computeAgentMetrics()
      expect(githubFetch).not.toHaveBeenCalled()
      expect(result1.generatedAt).toBe(result2.generatedAt)
    })

    it('does not cache filtered queries', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      await computeAgentMetrics('2026-03-01', '2026-03-14')
      vi.clearAllMocks()
      githubFetch.mockResolvedValue({ data: [] })
      await computeAgentMetrics('2026-03-01', '2026-03-14')
      expect(githubFetch).toHaveBeenCalled()
    })

    it('cleans up internal fields (_cycleTimes, _closeDates)', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      const result = await computeAgentMetrics()
      for (const [, metrics] of Object.entries(result.agents)) {
        expect(metrics._cycleTimes).toBeUndefined()
        expect(metrics._closeDates).toBeUndefined()
      }
    })
  })

  describe('snapshotAgentProductivity', () => {
    it('computes metrics and stores snapshot', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      await snapshotAgentProductivity()
      expect(insertSnapshot).toHaveBeenCalledWith(
        'agent-productivity', expect.any(String), expect.any(Object), expect.any(String),
      )
    })

    it('skips snapshot when hash unchanged', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      await snapshotAgentProductivity()
      const storedHash = insertSnapshot.mock.calls[0][3]
      vi.clearAllMocks()
      clearAgentMetricsCache()
      getLatestSnapshotHash.mockReturnValue(storedHash)
      githubFetch.mockResolvedValue({ data: [] })
      await snapshotAgentProductivity()
      expect(insertSnapshot).not.toHaveBeenCalled()
    })

    it('handles API errors gracefully', async () => {
      githubFetch.mockRejectedValue(new Error('GitHub down'))
      await expect(snapshotAgentProductivity()).resolves.not.toThrow()
    })
  })

  describe('queryProductivityHistory', () => {
    it('queries snapshots from agent-productivity channel', () => {
      querySnapshots.mockReturnValue([
        { timestamp: '2026-03-13T10:00:00Z', data: { dallas: {} } },
      ])
      const result = queryProductivityHistory('2026-03-01', '2026-03-14')
      expect(querySnapshots).toHaveBeenCalledWith('agent-productivity', '2026-03-01', '2026-03-14', '15m')
      expect(result).toHaveLength(1)
    })
  })

  describe('clearAgentMetricsCache', () => {
    it('invalidates cache, forcing fresh computation', async () => {
      githubFetch.mockResolvedValue({ data: [] })
      await computeAgentMetrics()
      vi.clearAllMocks()
      clearAgentMetricsCache()
      githubFetch.mockResolvedValue({ data: [] })
      await computeAgentMetrics()
      expect(githubFetch).toHaveBeenCalled()
    })
  })
})
