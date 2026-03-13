import {
  querySnapshots,
  getDailySummary,
  queryAgentSnapshots,
  getDbStats,
} from '../lib/metrics-db.js'
import { logger } from '../lib/logger.js'

const VALID_INTERVALS = ['5m', '15m', '1h', '6h', '1d']
const VALID_CHANNELS = ['issues', 'agents', 'actions']

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

export function metricsAgentsRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const data = queryAgentSnapshots(from, to)
    res.json({
      from: from || null,
      to: to || null,
      count: data.length,
      data,
    })
  } catch (err) {
    logger.error('Agent metrics query failed', { error: err.message })
    res.status(500).json({ error: 'Failed to query agent metrics' })
  }
}

export function metricsStatsRoute(req, res) {
  try {
    const stats = getDbStats()
    res.json(stats)
  } catch (err) {
    logger.error('Metrics stats query failed', { error: err.message })
    res.status(500).json({ error: 'Failed to query metrics stats' })
  }
}
