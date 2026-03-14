import { performanceTracker } from '../lib/performance-tracker.js'

/**
 * @openapi
 * /api/metrics/performance:
 *   get:
 *     summary: Get real-time performance metrics
 *     description: |
 *       Returns performance metrics over a 5-minute rolling window:
 *       - Response time percentiles (p50, p95, p99)
 *       - Request throughput (requests/min)
 *       - Error rate (percentage)
 *       - SSE connection count
 *       - SQLite query time statistics
 *       - Per-endpoint breakdown
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 windowMs:
 *                   type: number
 *                   description: Rolling window size in milliseconds
 *                   example: 300000
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Metric collection timestamp
 *                 requestsPerMinute:
 *                   type: number
 *                   description: Average requests per minute over window
 *                   example: 24.5
 *                 totalRequests:
 *                   type: number
 *                   description: Total requests in window
 *                   example: 123
 *                 totalErrors:
 *                   type: number
 *                   description: Total errors (status >= 400) in window
 *                   example: 2
 *                 errorRate:
 *                   type: number
 *                   description: Error rate as percentage
 *                   example: 1.63
 *                 responseTimes:
 *                   type: object
 *                   properties:
 *                     p50:
 *                       type: number
 *                       description: 50th percentile response time (ms)
 *                     p95:
 *                       type: number
 *                       description: 95th percentile response time (ms)
 *                     p99:
 *                       type: number
 *                       description: 99th percentile response time (ms)
 *                     min:
 *                       type: number
 *                       description: Minimum response time (ms)
 *                     max:
 *                       type: number
 *                       description: Maximum response time (ms)
 *                     avg:
 *                       type: number
 *                       description: Average response time (ms)
 *                 byEndpoint:
 *                   type: object
 *                   description: Per-endpoint breakdown
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       count:
 *                         type: number
 *                       errors:
 *                         type: number
 *                       errorRate:
 *                         type: number
 *                       p50:
 *                         type: number
 *                       p95:
 *                         type: number
 *                       p99:
 *                         type: number
 *                       avg:
 *                         type: number
 *                 sseConnections:
 *                   type: number
 *                   description: Current SSE connection count
 *                 sqliteQueryTime:
 *                   type: object
 *                   properties:
 *                     p50:
 *                       type: number
 *                       description: 50th percentile SQLite query time (ms)
 *                     p95:
 *                       type: number
 *                       description: 95th percentile SQLite query time (ms)
 *                     p99:
 *                       type: number
 *                       description: 99th percentile SQLite query time (ms)
 *                     avg:
 *                       type: number
 *                       description: Average SQLite query time (ms)
 */
export default function performanceRoute(req, res) {
  const metrics = performanceTracker.getMetrics()
  res.json(metrics)
}
