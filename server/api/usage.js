import { REPOS } from '../config.js'
import { githubFetch, handleGitHubError } from '../lib/github-client.js'
import { logger } from '../lib/logger.js'

const CACHE_TTL = 60_000 // 60 seconds per #122
let usageCache = null
let usageCacheTime = 0

// Aggregate CI minutes from recent workflow runs across all repos
async function aggregateWorkflowUsage() {
  let totalRunsCount = 0
  let totalDurationMs = 0
  const repoBreakdown = []

  for (const repo of REPOS) {
    const [owner, name] = repo.github.split('/')
    let repoRuns = 0
    let repoDurationMs = 0

    try {
      const { data } = await githubFetch(
        `/repos/${owner}/${name}/actions/runs?per_page=100&status=completed`
      )
      const runs = data.workflow_runs || []
      repoRuns = runs.length

      for (const run of runs) {
        if (run.created_at && run.updated_at) {
          const start = new Date(run.created_at).getTime()
          const end = new Date(run.updated_at).getTime()
          if (end > start) repoDurationMs += end - start
        }
      }
    } catch (err) {
      // Skip individual repo failures
      logger.warn('Failed to fetch workflow runs', { repo: repo.github, error: err.message })
    }

    totalRunsCount += repoRuns
    totalDurationMs += repoDurationMs
    repoBreakdown.push({
      repo: repo.github,
      label: repo.label,
      emoji: repo.emoji,
      runs: repoRuns,
      durationMinutes: Math.round(repoDurationMs / 60_000),
    })
  }

  const totalMinutes = Math.round(totalDurationMs / 60_000)

  // GitHub free tier: 2000 minutes/month for private repos, 500 for public (unlimited for public actually)
  const freeMinutesLimit = 2000

  return {
    totalRuns: totalRunsCount,
    totalMinutes,
    freeMinutesLimit,
    percentage: freeMinutesLimit > 0
      ? Math.min(100, Math.round((totalMinutes / freeMinutesLimit) * 100))
      : 0,
    repos: repoBreakdown,
  }
}

// Try org billing API first, fall back to workflow run aggregation
export async function fetchUsageData() {
  // Attempt org billing API (requires org admin access)
  for (const repo of REPOS) {
    const [owner] = repo.github.split('/')
    try {
      const { data: billing } = await githubFetch(
        `/orgs/${owner}/settings/billing/actions`
      )
      // Billing API succeeded — return structured data
      return {
        source: 'billing',
        totalMinutesUsed: billing.total_minutes_used || 0,
        includedMinutes: billing.included_minutes || 2000,
        paidMinutesUsed: billing.total_paid_minutes_used || 0,
        percentage: billing.included_minutes > 0
          ? Math.min(100, Math.round(
              (billing.total_minutes_used / billing.included_minutes) * 100
            ))
          : 0,
      }
    } catch {
      // Expected for user accounts or non-admin tokens — try next or fall back
    }
  }

  // Fallback: aggregate from workflow runs
  const aggregated = await aggregateWorkflowUsage()
  return {
    source: 'workflow_runs',
    totalMinutesUsed: aggregated.totalMinutes,
    includedMinutes: aggregated.freeMinutesLimit,
    totalRuns: aggregated.totalRuns,
    percentage: aggregated.percentage,
    repos: aggregated.repos,
  }
}

/**
 * @openapi
 * /api/usage:
 *   get:
 *     summary: Get GitHub Actions usage
 *     description: Returns CI/CD usage data. Tries org billing API first, falls back to aggregating workflow run durations across repos. Cached for 60 seconds per #122.
 *     tags: [Usage]
 *     responses:
 *       200:
 *         description: Usage data (billing or aggregated workflow runs)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usage'
 *       500:
 *         description: Failed to fetch usage data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default async function usageRoute(req, res) {
  try {
    if (usageCache && Date.now() - usageCacheTime < CACHE_TTL) {
      res.json(usageCache)
      return
    }

    const usage = await fetchUsageData()

    usageCache = usage
    usageCacheTime = Date.now()

    res.json(usage)
  } catch (err) {
    if (handleGitHubError(res, err)) return
    res.status(500).json({ error: 'Failed to fetch usage data' })
  }
}
