import { searchLogs } from '../lib/metrics-db.js'
import { logger } from '../lib/logger.js'

/**
 * @openapi
 * /api/logs/search:
 *   get:
 *     summary: Full-text search across log entries
 *     description: |
 *       Search log entries using SQLite FTS5 full-text search. Supports boolean operators (AND, OR, NOT),
 *       phrase queries with double quotes, and structured filters (agent, level, date range).
 *       Results are ranked by relevance and include highlighted snippets.
 *       
 *       **Query Syntax:**
 *       - Simple terms: `error github` (finds logs containing both words)
 *       - Boolean operators: `error AND github`, `timeout OR failure`, `github NOT api`
 *       - Phrase search: `"connection timeout"` (exact phrase match)
 *       - Field prefixes: `agent:ripley`, `level:error`
 *       - Wildcards: `connect*` (prefix search)
 *       
 *       **Performance:** Sub-100ms response time for 10K+ entries.
 *     tags: [Logs]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           example: error github api
 *         description: FTS5 search query. Supports AND, OR, NOT, phrases with quotes, wildcards.
 *       - in: query
 *         name: agent
 *         schema:
 *           type: string
 *           example: ripley
 *         description: Filter by agent name
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warn, error]
 *           example: error
 *         description: Filter by log level
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2026-03-13T00:00:00Z'
 *         description: Filter logs from this timestamp (inclusive)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2026-03-14T23:59:59Z'
 *         description: Filter logs until this timestamp (inclusive)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         description: Maximum number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Search results with relevance ranking and snippets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 42
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       agent:
 *                         type: string
 *                         example: ripley
 *                       level:
 *                         type: string
 *                         enum: [info, warn, error]
 *                       message:
 *                         type: string
 *                       messageSnippet:
 *                         type: string
 *                         description: Highlighted snippet with <mark> tags
 *                         example: 'GitHub API rate limit <mark>exceeded</mark>...'
 *                       context:
 *                         type: object
 *                         nullable: true
 *                       contextSnippet:
 *                         type: string
 *                         nullable: true
 *                       exitCode:
 *                         type: integer
 *                         nullable: true
 *                       durationMs:
 *                         type: integer
 *                         nullable: true
 *                       rank:
 *                         type: number
 *                         description: FTS5 relevance score (lower is better)
 *                 total:
 *                   type: integer
 *                   description: Total number of matching results
 *                   example: 247
 *                 hasMore:
 *                   type: boolean
 *                   description: Whether there are more results beyond this page
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       400:
 *         description: Invalid query or parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Search failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default function searchLogsRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    
    // Extract query parameters
    const query = url.searchParams.get('q')
    const agent = url.searchParams.get('agent')
    const level = url.searchParams.get('level')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')

    // Validate required query parameter
    if (!query || query.trim().length === 0) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Missing required parameter: q' }))
      return
    }

    // Parse and validate limit/offset
    let limit = 100
    let offset = 0

    if (limitParam) {
      limit = parseInt(limitParam, 10)
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Invalid limit: must be between 1 and 1000' }))
        return
      }
    }

    if (offsetParam) {
      offset = parseInt(offsetParam, 10)
      if (isNaN(offset) || offset < 0) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Invalid offset: must be non-negative' }))
        return
      }
    }

    // Validate level
    if (level && !['info', 'warn', 'error'].includes(level)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid level: must be info, warn, or error' }))
      return
    }

    // Validate date range
    if (from && isNaN(Date.parse(from))) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid from date format' }))
      return
    }

    if (to && isNaN(Date.parse(to))) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid to date format' }))
      return
    }

    // Perform search
    const startTime = Date.now()
    const searchOptions = {
      query: query.trim(),
      agent,
      level,
      from,
      to,
      limit,
      offset,
    }

    const result = searchLogs(searchOptions)
    const duration = Date.now() - startTime

    // Log search query for monitoring
    logger.info('Log search executed', {
      query: query.trim(),
      agent,
      level,
      resultCount: result.results.length,
      total: result.total,
      durationMs: duration,
    })

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('Log search failed', { error: err.message, stack: err.stack })
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || 'Search failed' }))
  }
}
