import { fetchIssues } from './board.js'
import { fetchUsageData } from './usage.js'
import { querySnapshots } from '../lib/metrics-db.js'
import { toCsv, setDownloadHeaders } from '../lib/csv.js'
import { handleGitHubError } from '../lib/github-client.js'
import { logger } from '../lib/logger.js'

const VALID_FORMATS = ['csv', 'json']
const VALID_STATES = ['open', 'closed', 'all']
const VALID_CHANNELS = ['issues', 'agents', 'actions']

function getFormat(req) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const qFormat = url.searchParams.get('format')
  if (qFormat && VALID_FORMATS.includes(qFormat)) return qFormat

  const accept = req.headers.accept || ''
  if (accept.includes('text/csv')) return 'csv'
  return 'json'
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

const ISSUE_COLUMNS = [
  { key: 'number', label: 'number' },
  { key: 'title', label: 'title' },
  { key: 'state', label: 'state' },
  { key: 'repo', label: 'repo' },
  { key: 'assignees', label: 'assignee', value: r => (r.assignees || []).join('; ') },
  { key: 'labels', label: 'labels', value: r => (r.labels || []).join('; ') },
  { key: 'createdAt', label: 'created_at' },
  { key: 'closedAt', label: 'closed_at', value: r => r.closedAt || '' },
  { key: 'url', label: 'url' },
]

/**
 * @openapi
 * /api/export/issues:
 *   get:
 *     summary: Export issues as CSV or JSON
 *     description: Downloads issues across all monitored repos. Supports CSV and JSON via format query param or Accept header.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: json
 *         description: Response format
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           enum: [open, closed, all]
 *           default: open
 *         description: Filter issues by state
 *       - in: query
 *         name: repo
 *         schema:
 *           type: string
 *         description: Filter by repo id (e.g. flora)
 *     responses:
 *       200:
 *         description: Issue data as CSV or JSON download
 *       500:
 *         description: Export failed
 */
export async function exportIssuesRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const state = url.searchParams.get('state') || 'open'
    const repoFilter = url.searchParams.get('repo')
    const format = getFormat(req)

    if (!VALID_STATES.includes(state)) {
      res.status(400).json({ error: `Invalid state. Must be one of: ${VALID_STATES.join(', ')}` })
      return
    }

    let issues = await fetchIssues(state)

    if (repoFilter) {
      issues = issues.filter(i => i.repo === repoFilter)
    }

    const filename = `ffs-issues-${dateStamp()}.${format}`
    setDownloadHeaders(res, filename, format)

    if (format === 'csv') {
      res.end(toCsv(issues, ISSUE_COLUMNS))
    } else {
      res.end(JSON.stringify(issues, null, 2))
    }
  } catch (err) {
    if (handleGitHubError(res, err)) return
    logger.error('Issue export failed', { error: err.message })
    res.status(500).json({ error: 'Failed to export issues' })
  }
}

/**
 * @openapi
 * /api/export/metrics:
 *   get:
 *     summary: Export metric snapshots as CSV or JSON
 *     description: Downloads historical metric snapshots. Supports CSV and JSON via format query param or Accept header.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: json
 *         description: Response format
 *       - in: query
 *         name: channel
 *         required: true
 *         schema:
 *           type: string
 *           enum: [issues, agents, actions]
 *         description: Metric channel
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
 *         description: Metric data as CSV or JSON download
 *       400:
 *         description: Invalid channel
 *       500:
 *         description: Export failed
 */
export function exportMetricsRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const channel = url.searchParams.get('channel')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const format = getFormat(req)

    if (!channel || !VALID_CHANNELS.includes(channel)) {
      res.status(400).json({ error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` })
      return
    }

    const data = querySnapshots(channel, from, to, '5m')

    const filename = `ffs-metrics-${channel}-${dateStamp()}.${format}`
    setDownloadHeaders(res, filename, format)

    if (format === 'csv') {
      const METRICS_COLUMNS = [
        { key: 'timestamp', label: 'timestamp' },
        { key: 'channel', label: 'channel' },
        { key: 'data', label: 'data', value: r => JSON.stringify(r.data) },
      ]
      res.end(toCsv(data, METRICS_COLUMNS))
    } else {
      res.end(JSON.stringify(data, null, 2))
    }
  } catch (err) {
    logger.error('Metrics export failed', { error: err.message })
    res.status(500).json({ error: 'Failed to export metrics' })
  }
}

/**
 * @openapi
 * /api/export/usage:
 *   get:
 *     summary: Export CI/CD usage as CSV or JSON
 *     description: Downloads GitHub Actions usage data. Supports CSV and JSON via format query param or Accept header.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: json
 *         description: Response format
 *     responses:
 *       200:
 *         description: Usage data as CSV or JSON download
 *       500:
 *         description: Export failed
 */
export async function exportUsageRoute(req, res) {
  try {
    const format = getFormat(req)
    const usage = await fetchUsageData()

    const filename = `ffs-usage-${dateStamp()}.${format}`
    setDownloadHeaders(res, filename, format)

    if (format === 'csv') {
      if (usage.repos && usage.repos.length > 0) {
        const USAGE_COLUMNS = [
          { key: 'label', label: 'repo' },
          { key: 'runs', label: 'workflow_runs' },
          { key: 'durationMinutes', label: 'duration_minutes' },
        ]
        res.end(toCsv(usage.repos, USAGE_COLUMNS))
      } else {
        const BILLING_COLUMNS = [
          { key: 'totalMinutesUsed', label: 'total_minutes_used' },
          { key: 'includedMinutes', label: 'included_minutes' },
          { key: 'paidMinutesUsed', label: 'paid_minutes_used' },
          { key: 'percentage', label: 'usage_percentage' },
        ]
        res.end(toCsv([usage], BILLING_COLUMNS))
      }
    } else {
      res.end(JSON.stringify(usage, null, 2))
    }
  } catch (err) {
    if (handleGitHubError(res, err)) return
    logger.error('Usage export failed', { error: err.message })
    res.status(500).json({ error: 'Failed to export usage data' })
  }
}
