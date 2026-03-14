import { REPOS } from '../config.js'
import { githubFetch, handleGitHubError } from '../lib/github-client.js'

const CACHE_TTL = 60_000 // 60 seconds per #122
let eventsCache = null
let eventsCacheTime = 0

/**
 * Fetch and aggregate events across all repos.
 * Shared by HTTP handler and data poller.
 */
export async function fetchEvents() {
  const allEvents = []

  for (const repo of REPOS) {
    try {
      const [owner, name] = repo.github.split('/')
      const { data: events } = await githubFetch(
        `/repos/${owner}/${name}/events?per_page=30`
      )

      for (const event of events) {
        allEvents.push({
          id: event.id,
          type: event.type,
          repo: `${owner}/${name}`,
          actor: event.actor?.login || 'unknown',
          createdAt: event.created_at,
          payload: event.payload || {},
        })
      }
    } catch {
      // Skip individual repo failures
    }
  }

  allEvents.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  )

  return allEvents.slice(0, 100)
}

/**
 * @openapi
 * /api/events:
 *   get:
 *     summary: Get recent GitHub events
 *     description: Aggregates recent GitHub events across all monitored repositories. Cached for 60 seconds per #122. Returns up to 100 events sorted by most recent first.
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: Array of recent GitHub events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Event'
 *       500:
 *         description: Failed to fetch events
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: GitHub API rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default async function eventsRoute(req, res) {
  try {
    if (eventsCache && Date.now() - eventsCacheTime < CACHE_TTL) {
      res.json(eventsCache)
      return
    }

    const capped = await fetchEvents()

    eventsCache = capped
    eventsCacheTime = Date.now()

    res.json(capped)
  } catch (err) {
    if (handleGitHubError(res, err)) return
    res.status(500).json({ error: 'Failed to fetch events' })
  }
}
