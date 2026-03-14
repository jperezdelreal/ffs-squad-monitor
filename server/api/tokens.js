import { logger } from '../lib/logger.js'
import { queryTokenUsage, getTokenUsageSummary } from '../lib/metrics-db.js'
import { aggregateByModel, aggregateByAgent } from '../lib/token-usage.js'

/**
 * @openapi
 * /api/usage/tokens:
 *   get:
 *     summary: Query LLM token usage and costs
 *     description: Returns token usage records with cost estimates, aggregated by model and agent. Supports filtering by date range and agent.
 *     tags: [Usage]
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
 *       - in: query
 *         name: agent
 *         schema:
 *           type: string
 *         description: Filter by agent name
 *     responses:
 *       200:
 *         description: Token usage data with cost breakdowns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                 byModel:
 *                   type: object
 *                 byAgent:
 *                   type: object
 *                 records:
 *                   type: array
 *       500:
 *         description: Failed to query token usage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default function tokensRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const agent = url.searchParams.get('agent')

    // Validate date params
    if (from && isNaN(Date.parse(from))) {
      res.status(400).json({ error: 'Invalid from date format' })
      return
    }
    if (to && isNaN(Date.parse(to))) {
      res.status(400).json({ error: 'Invalid to date format' })
      return
    }

    const records = queryTokenUsage({ from, to, agent })
    const summary = getTokenUsageSummary({ from, to, agent })
    const byModel = aggregateByModel(records)
    const byAgent = aggregateByAgent(records)

    res.json({
      summary,
      byModel,
      byAgent,
      count: records.length,
      records,
    })
  } catch (err) {
    logger.error('Token usage query failed', { error: err.message })
    res.status(500).json({ error: 'Failed to query token usage' })
  }
}
