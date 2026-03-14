import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

vi.mock('../event-bus.js', () => ({
  eventBus: {
    publish: vi.fn(),
  },
}))

import { performanceTracker, performanceMiddleware } from '../performance-tracker.js'
import { eventBus } from '../event-bus.js'

describe('PerformanceTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    performanceTracker.reset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('recordRequest', () => {
    it('tracks request timing and status', () => {
      performanceTracker.recordRequest('/api/heartbeat', 50, 200)
      performanceTracker.recordRequest('/api/issues', 120, 200)
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.totalRequests).toBe(2)
      expect(metrics.totalErrors).toBe(0)
      expect(metrics.responseTimes.p50).toBeGreaterThan(0)
    })

    it('tracks errors when status >= 400', () => {
      performanceTracker.recordRequest('/api/test', 100, 404)
      performanceTracker.recordRequest('/api/test', 200, 500)
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.totalErrors).toBe(2)
      expect(metrics.errorRate).toBeGreaterThan(0)
    })

    it('publishes alert when p95 exceeds threshold', () => {
      process.env.PERF_THRESHOLD_MS = '100'
      
      for (let i = 0; i < 100; i++) {
        performanceTracker.recordRequest('/api/slow', 150, 200)
      }
      
      expect(eventBus.publish).toHaveBeenCalledWith(
        'alerts',
        'performance-degraded',
        expect.objectContaining({
          metric: 'response_time_p95',
          threshold: 100,
        })
      )
      
      delete process.env.PERF_THRESHOLD_MS
    })
  })

  describe('percentile calculation', () => {
    it('calculates p50, p95, p99 correctly', () => {
      const durations = Array.from({ length: 100 }, (_, i) => i + 1)
      durations.forEach(d => performanceTracker.recordRequest('/api/test', d, 200))
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.responseTimes.p50).toBeCloseTo(50, 0)
      expect(metrics.responseTimes.p95).toBeCloseTo(95, 0)
      expect(metrics.responseTimes.p99).toBeCloseTo(99, 0)
    })

    it('handles empty data', () => {
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.responseTimes.p50).toBe(0)
      expect(metrics.responseTimes.p95).toBe(0)
      expect(metrics.responseTimes.p99).toBe(0)
    })
  })

  describe('rolling window', () => {
    it('removes old data outside 5-minute window', () => {
      performanceTracker.recordRequest('/api/test', 100, 200)
      
      vi.advanceTimersByTime(6 * 60 * 1000) // 6 minutes
      
      performanceTracker.recordRequest('/api/test', 200, 200)
      
      const metrics = performanceTracker.getMetrics()
      expect(metrics.totalRequests).toBe(1)
    })
  })

  describe('byEndpoint breakdown', () => {
    it('groups metrics by endpoint', () => {
      performanceTracker.recordRequest('/api/heartbeat', 50, 200)
      performanceTracker.recordRequest('/api/heartbeat', 60, 200)
      performanceTracker.recordRequest('/api/issues', 120, 200)
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.byEndpoint['/api/heartbeat']).toBeDefined()
      expect(metrics.byEndpoint['/api/heartbeat'].count).toBe(2)
      expect(metrics.byEndpoint['/api/issues'].count).toBe(1)
    })

    it('calculates per-endpoint error rates', () => {
      performanceTracker.recordRequest('/api/test', 50, 200)
      performanceTracker.recordRequest('/api/test', 60, 404)
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.byEndpoint['/api/test'].errors).toBe(1)
      expect(metrics.byEndpoint['/api/test'].errorRate).toBe(50)
    })
  })

  describe('recordSqliteQuery', () => {
    it('tracks SQLite query times', () => {
      performanceTracker.recordSqliteQuery(5)
      performanceTracker.recordSqliteQuery(10)
      performanceTracker.recordSqliteQuery(15)
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.sqliteQueryTime.avg).toBeCloseTo(10, 1)
      expect(metrics.sqliteQueryTime.p50).toBeCloseTo(10, 1)
    })
  })

  describe('setSseConnectionCount', () => {
    it('updates SSE connection count', () => {
      performanceTracker.setSseConnectionCount(5)
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.sseConnections).toBe(5)
    })
  })

  describe('requestsPerMinute', () => {
    it('calculates throughput correctly', () => {
      for (let i = 0; i < 10; i++) {
        performanceTracker.recordRequest('/api/test', 50, 200)
      }
      
      const metrics = performanceTracker.getMetrics()
      
      expect(metrics.requestsPerMinute).toBeGreaterThan(0)
    })
  })
})

describe('performanceMiddleware', () => {
  it('records request timing in res finish event', () => {
    const req = {
      route: { path: '/api/test' },
      path: '/api/test',
      url: '/api/test',
    }
    const res = {
      statusCode: 200,
      on: vi.fn((event, handler) => {
        if (event === 'finish') {
          setTimeout(() => handler(), 50)
        }
      }),
    }
    const next = vi.fn()
    
    performanceTracker.reset()
    performanceMiddleware(req, res, next)
    
    expect(next).toHaveBeenCalled()
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function))
  })
})
