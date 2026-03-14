import { logger } from './logger.js'
import { eventBus } from './event-bus.js'

const WINDOW_MS = 5 * 60 * 1000 // 5 minutes

class PerformanceTracker {
  constructor() {
    this.requests = []
    this.errors = []
    this.sseConnections = 0
    this.sqliteQueryTimes = []
    this._log = logger.child({ component: 'performance-tracker' })
  }

  recordRequest(endpoint, duration, statusCode) {
    const now = Date.now()
    this.requests.push({
      endpoint,
      duration,
      statusCode,
      timestamp: now,
      isError: statusCode >= 400,
    })

    if (statusCode >= 400) {
      this.errors.push({
        endpoint,
        statusCode,
        timestamp: now,
      })
    }

    this._cleanupOldData(now)
    this._checkForDegradation(duration)
  }

  recordSqliteQuery(duration) {
    const now = Date.now()
    this.sqliteQueryTimes.push({
      duration,
      timestamp: now,
    })
    this._cleanupOldData(now)
  }

  setSseConnectionCount(count) {
    this.sseConnections = count
  }

  _cleanupOldData(now) {
    const cutoff = now - WINDOW_MS
    this.requests = this.requests.filter(r => r.timestamp > cutoff)
    this.errors = this.errors.filter(e => e.timestamp > cutoff)
    this.sqliteQueryTimes = this.sqliteQueryTimes.filter(q => q.timestamp > cutoff)
  }

  _checkForDegradation(duration) {
    const threshold = parseInt(process.env.PERF_THRESHOLD_MS) || 1000
    const metrics = this.getMetrics()

    if (metrics.responseTimes.p95 > threshold) {
      this._log.warn('Performance degradation detected', {
        p95: metrics.responseTimes.p95,
        threshold,
      })

      eventBus.publish('alerts', 'performance-degraded', {
        metric: 'response_time_p95',
        value: metrics.responseTimes.p95,
        threshold,
        timestamp: new Date().toISOString(),
      })
    }
  }

  getMetrics() {
    const now = Date.now()
    const cutoff = now - WINDOW_MS

    const recentRequests = this.requests.filter(r => r.timestamp > cutoff)
    const recentErrors = this.errors.filter(e => e.timestamp > cutoff)
    const recentSqlite = this.sqliteQueryTimes.filter(q => q.timestamp > cutoff)

    const durations = recentRequests.map(r => r.duration).sort((a, b) => a - b)

    const totalRequests = recentRequests.length
    const totalErrors = recentErrors.length
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    const requestsPerMinute = totalRequests > 0
      ? (totalRequests / (WINDOW_MS / 60000))
      : 0

    const responseTimes = {
      p50: this._percentile(durations, 50),
      p95: this._percentile(durations, 95),
      p99: this._percentile(durations, 99),
      min: durations.length > 0 ? durations[0] : 0,
      max: durations.length > 0 ? durations[durations.length - 1] : 0,
      avg: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    }

    const byEndpoint = this._groupByEndpoint(recentRequests)

    const sqliteTimes = recentSqlite.map(q => q.duration).sort((a, b) => a - b)
    const sqliteQueryTime = {
      p50: this._percentile(sqliteTimes, 50),
      p95: this._percentile(sqliteTimes, 95),
      p99: this._percentile(sqliteTimes, 99),
      avg: sqliteTimes.length > 0 ? sqliteTimes.reduce((a, b) => a + b, 0) / sqliteTimes.length : 0,
    }

    return {
      windowMs: WINDOW_MS,
      timestamp: new Date().toISOString(),
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      totalRequests,
      totalErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      responseTimes: {
        p50: Math.round(responseTimes.p50 * 100) / 100,
        p95: Math.round(responseTimes.p95 * 100) / 100,
        p99: Math.round(responseTimes.p99 * 100) / 100,
        min: Math.round(responseTimes.min * 100) / 100,
        max: Math.round(responseTimes.max * 100) / 100,
        avg: Math.round(responseTimes.avg * 100) / 100,
      },
      byEndpoint,
      sseConnections: this.sseConnections,
      sqliteQueryTime: {
        p50: Math.round(sqliteQueryTime.p50 * 100) / 100,
        p95: Math.round(sqliteQueryTime.p95 * 100) / 100,
        p99: Math.round(sqliteQueryTime.p99 * 100) / 100,
        avg: Math.round(sqliteQueryTime.avg * 100) / 100,
      },
    }
  }

  _percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0
    const index = (p / 100) * (sortedArray.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
  }

  _groupByEndpoint(requests) {
    const grouped = {}

    for (const req of requests) {
      if (!grouped[req.endpoint]) {
        grouped[req.endpoint] = {
          count: 0,
          errors: 0,
          durations: [],
        }
      }
      grouped[req.endpoint].count++
      if (req.isError) grouped[req.endpoint].errors++
      grouped[req.endpoint].durations.push(req.duration)
    }

    const result = {}
    for (const [endpoint, data] of Object.entries(grouped)) {
      const sorted = data.durations.sort((a, b) => a - b)
      result[endpoint] = {
        count: data.count,
        errors: data.errors,
        errorRate: Math.round((data.errors / data.count) * 10000) / 100,
        p50: Math.round(this._percentile(sorted, 50) * 100) / 100,
        p95: Math.round(this._percentile(sorted, 95) * 100) / 100,
        p99: Math.round(this._percentile(sorted, 99) * 100) / 100,
        avg: Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100,
      }
    }

    return result
  }

  reset() {
    this.requests = []
    this.errors = []
    this.sqliteQueryTimes = []
    this.sseConnections = 0
  }
}

export const performanceTracker = new PerformanceTracker()

export function performanceMiddleware(req, res, next) {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const endpoint = req.route?.path || req.path || req.url
    performanceTracker.recordRequest(endpoint, duration, res.statusCode)
  })

  next()
}
