import fs from 'fs'
import { config } from '../config.js'
import { getRateLimitStatus, githubFetch } from '../lib/github-client.js'
import { getHeartbeatResponse } from './heartbeat.js'
import { getDbStats } from '../lib/metrics-db.js'
import { eventBus } from '../lib/event-bus.js'
import { logger } from '../lib/logger.js'

let lastGithubCheck = null
let lastGithubReachable = null
const GITHUB_CHECK_INTERVAL = 60_000

async function checkGitHubReachable() {
  const now = Date.now()
  if (lastGithubCheck && now - lastGithubCheck < GITHUB_CHECK_INTERVAL) {
    return lastGithubReachable
  }

  try {
    await githubFetch('/rate_limit')
    lastGithubReachable = true
  } catch (err) {
    logger.warn('GitHub API unreachable during health check', { error: err.message })
    lastGithubReachable = false
  }
  lastGithubCheck = now
  return lastGithubReachable
}

function checkHeartbeatFile() {
  try {
    fs.accessSync(config.heartbeatPath, fs.constants.R_OK)
    return { accessible: true, path: config.heartbeatPath }
  } catch {
    return { accessible: false, path: config.heartbeatPath }
  }
}

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Detailed health check
 *     description: Returns comprehensive health status including GitHub API reachability, heartbeat file accessibility, rate limit info, metrics DB stats, and SSE connection count.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Health check response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
export default async function healthRoute(req, res) {
  const rl = getRateLimitStatus()
  const heartbeatFile = checkHeartbeatFile()
  const heartbeat = getHeartbeatResponse()
  const githubReachable = await checkGitHubReachable()

  const rateLimitHealthy = rl.remaining === null || rl.remaining > 100
  const heartbeatHealthy = heartbeatFile.accessible && heartbeat.status !== 'offline'

  let overallStatus = 'healthy'
  if (!githubReachable || !heartbeatHealthy) {
    overallStatus = !githubReachable && !heartbeatHealthy ? 'unhealthy' : 'degraded'
  }
  if (!rateLimitHealthy) {
    overallStatus = rl.remaining === 0 ? 'unhealthy' : 'degraded'
  }

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    dependencies: {
      github: {
        reachable: githubReachable,
        authenticated: !!config.githubToken,
        rateLimit: {
          remaining: rl.remaining,
          limit: rl.limit,
          resetsAt: rl.reset ? new Date(rl.reset * 1000).toISOString() : null,
          healthy: rateLimitHealthy,
        },
      },
      heartbeat: {
        fileAccessible: heartbeatFile.accessible,
        status: heartbeat.status || 'unknown',
        lastTimestamp: heartbeat.timestamp || null,
        healthy: heartbeatHealthy,
      },
      metricsDb: (() => {
        try { return getDbStats() } catch { return null }
      })(),
    },
    sse: eventBus.getConnectionInfo(),
  })
}

// Reset cached state (for testing)
export function resetHealthState() {
  lastGithubCheck = null
  lastGithubReachable = null
}
