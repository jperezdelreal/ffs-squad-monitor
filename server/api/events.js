import { REPOS } from '../config.js'
import { githubFetch, handleGitHubError } from '../lib/github-client.js'

const CACHE_TTL = 30_000
let eventsCache = null
let eventsCacheTime = 0

export default async function eventsRoute(req, res) {
  try {
    if (eventsCache && Date.now() - eventsCacheTime < CACHE_TTL) {
      res.json(eventsCache)
      return
    }

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
      } catch (err) {
        if (handleGitHubError(res, err)) return
        // Skip individual repo failures
      }
    }

    allEvents.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    )

    const capped = allEvents.slice(0, 100)

    eventsCache = capped
    eventsCacheTime = Date.now()

    res.json(capped)
  } catch (err) {
    if (handleGitHubError(res, err)) return
    res.status(500).json({ error: 'Failed to fetch events' })
  }
}
