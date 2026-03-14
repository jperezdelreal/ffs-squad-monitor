import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/logger.js', () => ({
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

vi.mock('../../lib/metrics-db.js', () => ({
  querySnapshots: vi.fn(() => []),
  getDailySummary: vi.fn(() => ({ date: '2026-03-13', channels: {} })),
  queryAgentSnapshots: vi.fn(() => []),
  getDbStats: vi.fn(() => ({
    path: '/tmp/test.sqlite',
    sizeBytes: 4096,
    sizeMB: 0,
    snapshots: 5,
    summaries: 2,
    retentionDays: 30,
  })),
}))

vi.mock('../../lib/agent-metrics.js', () => ({
  computeAgentMetrics: vi.fn(async () => ({
    agents: { ripley: { issuesAssigned: 3 } },
    period: { from: null, to: null },
    generatedAt: '2026-03-13T12:00:00Z',
  })),
  queryProductivityHistory: vi.fn(() => []),
}))

vi.mock('../../lib/github-client.js', () => ({
  handleGitHubError: vi.fn(() => false),
}))

import { metricsRoute, metricsSummaryRoute, metricsAgentsRoute, metricsStatsRoute } from '../metrics.js'
import { querySnapshots, getDailySummary, getDbStats } from '../../lib/metrics-db.js'
import { computeAgentMetrics, queryProductivityHistory } from '../../lib/agent-metrics.js'

function createReq(url) {
  return { url, headers: { host: 'localhost:3001' } }
}

function createRes() {
  const res = {
    statusCode: 200,
    _jsonBody: null,
    status: vi.fn(function(code) { this.statusCode = code; return this }),
    json: vi.fn(function(data) { this._jsonBody = data }),
    set: vi.fn(),
  }
  return res
}

describe('Metrics API Routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/metrics', () => {
    it('returns time-series data for valid channel', () => {
      const mockData = [
        { timestamp: '2026-03-13T10:00:00Z', channel: 'issues', data: { total: 5 } },
        { timestamp: '2026-03-13T11:00:00Z', channel: 'issues', data: { total: 6 } },
      ]
      querySnapshots.mockReturnValue(mockData)
      const req = createReq('/api/metrics?channel=issues')
      const res = createRes()
      metricsRoute(req, res)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'issues', interval: '1h', count: 2, data: mockData })
      )
    })

    it('uses default interval of 1h', () => {
      querySnapshots.mockReturnValue([])
      const req = createReq('/api/metrics?channel=issues')
      const res = createRes()
      metricsRoute(req, res)
      expect(querySnapshots).toHaveBeenCalledWith('issues', null, null, '1h')
    })

    it('accepts custom interval parameter', () => {
      querySnapshots.mockReturnValue([])
      const req = createReq('/api/metrics?channel=agents&interval=5m')
      const res = createRes()
      metricsRoute(req, res)
      expect(querySnapshots).toHaveBeenCalledWith('agents', null, null, '5m')
    })

    it('accepts from and to parameters', () => {
      querySnapshots.mockReturnValue([])
      const req = createReq('/api/metrics?channel=issues&from=2026-03-10T00:00:00Z&to=2026-03-13T23:59:59Z')
      const res = createRes()
      metricsRoute(req, res)
      expect(querySnapshots).toHaveBeenCalledWith('issues', '2026-03-10T00:00:00Z', '2026-03-13T23:59:59Z', '1h')
    })

    it('returns null for missing from/to', () => {
      querySnapshots.mockReturnValue([])
      const req = createReq('/api/metrics?channel=issues')
      const res = createRes()
      metricsRoute(req, res)
      expect(res._jsonBody.from).toBeNull()
      expect(res._jsonBody.to).toBeNull()
    })

    it('returns 400 for missing channel', () => {
      const req = createReq('/api/metrics')
      const res = createRes()
      metricsRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res._jsonBody.error).toContain('Invalid channel')
    })

    it('returns 400 for invalid channel', () => {
      const req = createReq('/api/metrics?channel=bogus')
      const res = createRes()
      metricsRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns 400 for invalid interval', () => {
      const req = createReq('/api/metrics?channel=issues&interval=3h')
      const res = createRes()
      metricsRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res._jsonBody.error).toContain('Invalid interval')
    })

    it('returns empty data with count 0 for no results', () => {
      querySnapshots.mockReturnValue([])
      const req = createReq('/api/metrics?channel=actions')
      const res = createRes()
      metricsRoute(req, res)
      expect(res._jsonBody.data).toEqual([])
      expect(res._jsonBody.count).toBe(0)
    })

    it('returns 500 on internal error', () => {
      querySnapshots.mockImplementation(() => { throw new Error('DB error') })
      const req = createReq('/api/metrics?channel=issues')
      const res = createRes()
      metricsRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })

    it('supports all valid channels', () => {
      querySnapshots.mockReturnValue([])
      for (const channel of ['issues', 'agents', 'actions']) {
        const req = createReq(`/api/metrics?channel=${channel}`)
        const res = createRes()
        metricsRoute(req, res)
        expect(res.status).not.toHaveBeenCalledWith(400)
      }
    })

    it('supports all valid intervals', () => {
      querySnapshots.mockReturnValue([])
      for (const interval of ['5m', '15m', '1h', '6h', '1d']) {
        const req = createReq(`/api/metrics?channel=issues&interval=${interval}`)
        const res = createRes()
        metricsRoute(req, res)
        expect(res.status).not.toHaveBeenCalledWith(400)
      }
    })
  })

  describe('GET /api/metrics/summary', () => {
    it('returns daily summary for valid date', () => {
      getDailySummary.mockReturnValue({
        date: '2026-03-13', channels: { issues: { snapshotCount: 5 } },
      })
      const req = createReq('/api/metrics/summary?date=2026-03-13')
      const res = createRes()
      metricsSummaryRoute(req, res)
      expect(getDailySummary).toHaveBeenCalledWith('2026-03-13')
      expect(res._jsonBody.date).toBe('2026-03-13')
    })

    it('returns 400 for missing date', () => {
      const req = createReq('/api/metrics/summary')
      const res = createRes()
      metricsSummaryRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns 400 for invalid date format', () => {
      const req = createReq('/api/metrics/summary?date=13-03-2026')
      const res = createRes()
      metricsSummaryRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('returns 500 on internal error', () => {
      getDailySummary.mockImplementation(() => { throw new Error('DB error') })
      const req = createReq('/api/metrics/summary?date=2026-03-13')
      const res = createRes()
      metricsSummaryRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('GET /api/metrics/agents', () => {
    it('returns live agent metrics', async () => {
      const req = createReq('/api/metrics/agents')
      const res = createRes()
      await metricsAgentsRoute(req, res)
      expect(computeAgentMetrics).toHaveBeenCalled()
      expect(res._jsonBody.agents).toBeTruthy()
    })

    it('passes from/to parameters to computation', async () => {
      queryProductivityHistory.mockReturnValue([])
      const req = createReq('/api/metrics/agents?from=2026-03-01&to=2026-03-14')
      const res = createRes()
      await metricsAgentsRoute(req, res)
      expect(computeAgentMetrics).toHaveBeenCalledWith('2026-03-01', '2026-03-14', null)
    })

    it('passes agent filter', async () => {
      const req = createReq('/api/metrics/agents?agent=dallas')
      const res = createRes()
      await metricsAgentsRoute(req, res)
      expect(computeAgentMetrics).toHaveBeenCalledWith(null, null, 'dallas')
    })

    it('includes history when historical snapshots exist', async () => {
      queryProductivityHistory.mockReturnValue([
        { timestamp: '2026-03-12T10:00:00Z', data: { dallas: { issuesAssigned: 2 } } },
      ])
      const req = createReq('/api/metrics/agents?from=2026-03-01&to=2026-03-14')
      const res = createRes()
      await metricsAgentsRoute(req, res)
      expect(res._jsonBody.history).toHaveLength(1)
    })

    it('returns 500 on internal error', async () => {
      computeAgentMetrics.mockRejectedValue(new Error('GitHub error'))
      const req = createReq('/api/metrics/agents')
      const res = createRes()
      await metricsAgentsRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('GET /api/metrics/stats', () => {
    it('returns database statistics', () => {
      const req = createReq('/api/metrics/stats')
      const res = createRes()
      metricsStatsRoute(req, res)
      expect(getDbStats).toHaveBeenCalled()
      expect(res._jsonBody.snapshots).toBe(5)
    })

    it('returns 500 on internal error', () => {
      getDbStats.mockImplementation(() => { throw new Error('DB error') })
      const req = createReq('/api/metrics/stats')
      const res = createRes()
      metricsStatsRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})
