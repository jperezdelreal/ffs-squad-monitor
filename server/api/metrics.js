import {
  querySnapshots,
  getDailySummary,
  queryAgentSnapshots,
  getDbStats,
} from '../lib/metrics-db.js'
import { computeAgentMetrics, queryProductivityHistory } from '../lib/agent-metrics.js'
import { handleGitHubError } from '../lib/github-client.js'
import { logger } from '../lib/logger.js'

const VALID_INTERVALS = ['5m', '15m', '1h', '6h', '1d']
const VALID_CHANNELS = ['issues', 'agents', 'actions']

/**
 * @openapi
 * /api/metrics:
 *   get:
 *     summary: Query historical metric snapshots
 *     description: Returns time-series metric data for a given channel, optionally filtered by date range and aggregation interval.
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: channel
 *         required: true
 *         schema:
 *           type: string
 *           enum: [issues, agents, actions]
 *         description: Metric channel to query
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of date range (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range (ISO 8601)
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: ['5m', '15m', '1h', '6h', '1d']
 *           default: '1h'
 *         description: Aggregation interval
 *     responses:
 *       200:
 *         description: Metric snapshots
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetricsResponse'
 *       400:
 *         description: Invalid channel or interval
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Query failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export function metricsRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const channel = url.searchParams.get('channel')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const interval = url.searchParams.get('interval') || '1h'

    if (!channel || !VALID_CHANNELS.includes(channel)) {
      res.status(400).json({
        error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`,
      })
      return
    }

    if (!VALID_INTERVALS.includes(interval)) {
      res.status(400).json({
        error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`,
      })
      return
    }

    const data = querySnapshots(channel, from, to, interval)
    res.json({
      channel,
      interval,
      from: from || null,
      to: to || null,
      count: data.length,
      data,
    })
  } catch (err) {
    logger.error('Metrics query failed', { error: err.message })
    res.status(500).json({ error: 'Failed to query metrics' })
  }
}

/**
 * @openapi
 * /api/metrics/summary:
 *   get:
 *     summary: Get daily metrics summary
 *     description: Returns aggregated metric summary for a specific date.
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: '2026-03-13'
 *         description: Date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Daily summary data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Aggregated daily metrics
 *       400:
 *         description: Invalid date format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Query failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export function metricsSummaryRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const date = url.searchParams.get('date')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        error: 'Invalid date. Must be in YYYY-MM-DD format.',
      })
      return
    }

    const summary = getDailySummary(date)
    res.json(summary)
  } catch (err) {
    logger.error('Metrics summary query failed', { error: err.message })
    res.status(500).json({ error: 'Failed to query daily summary' })
  }
}

/**
 * @openapi
 * /api/metrics/agents:
 *   get:
 *     summary: Get agent productivity metrics
 *     description: Returns agent-level metric snapshots, optionally filtered by date range.
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of date range (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range (ISO 8601)
 *     responses:
 *       200:
 *         description: Agent metric snapshots
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentMetricsResponse'
 *       500:
 *         description: Query failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function metricsAgentsRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const agent = url.searchParams.get('agent')

    // If date range provided, try historical snapshots first
    if (from || to) {
      const history = queryProductivityHistory(from, to)
      if (history.length > 0) {
        // Merge historical snapshots with a live computation for completeness
        const live = await computeAgentMetrics(from, to, agent)
        res.json({
          ...live,
          history: history.map(s => ({
            timestamp: s.timestamp,
            agents: s.data,
          })),
        })
        return
      }
    }

    // Live computation from GitHub data
    const metrics = await computeAgentMetrics(from, to, agent)
    res.json(metrics)
  } catch (err) {
    if (handleGitHubError(res, err)) return
    logger.error('Agent productivity metrics failed', { error: err.message })
    res.status(500).json({ error: 'Failed to compute agent productivity metrics' })
  }
}

/**
 * @openapi
 * /api/metrics/stats:
 *   get:
 *     summary: Get metrics database statistics
 *     description: Returns internal statistics about the metrics SQLite database (row counts, file size, etc).
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Database statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Metrics DB stats (row counts, file size)
 *       500:
 *         description: Query failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export function metricsStatsRoute(req, res) {
  try {
    const stats = getDbStats()
    res.json(stats)
  } catch (err) {
    logger.error('Metrics stats query failed', { error: err.message })
    res.status(500).json({ error: 'Failed to query metrics stats' })
  }
}
