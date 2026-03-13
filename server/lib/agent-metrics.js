import crypto from 'crypto'
import { REPOS, SQUAD_AGENTS } from '../config.js'
import { githubFetch } from './github-client.js'
import { insertSnapshot, getLatestSnapshotHash, querySnapshots } from './metrics-db.js'
import { logger } from './logger.js'

const log = logger.child({ service: 'agent-metrics' })

const CACHE_TTL = 5 * 60 * 1000
const SNAPSHOT_CHANNEL = 'agent-productivity'

let cache = null
let cacheTime = 0

// Build deduplicated list of GitHub repos where squad agents work
function getAllSquadRepos() {
  const repoIds = new Set()
  for (const meta of Object.values(SQUAD_AGENTS)) {
    if (meta.repo === 'all') continue
    repoIds.add(meta.repo)
  }

  const githubRepos = new Set()
  for (const repoId of repoIds) {
    const repo = REPOS.find(r => r.id === repoId)
    if (repo) {
      githubRepos.add(repo.github)
    } else {
      githubRepos.add(`jperezdelreal/${repoId}`)
    }
  }
  return [...githubRepos]
}

// Extract agent ID from squad labels (e.g. "squad:dallas" → "dallas")
function extractAgent(labels) {
  for (const label of labels) {
    const name = typeof label === 'string' ? label : label.name
    if (!name) continue
    const match = name.match(/^squad:(\w+)$/)
    if (match && SQUAD_AGENTS[match[1]]) return match[1]
  }
  return null
}

// Fetch all issues with squad labels from a single repo
async function fetchSquadIssues(owner, name) {
  const issues = []
  let page = 1

  while (page <= 5) {
    try {
      const { data } = await githubFetch(
        `/repos/${owner}/${name}/issues?state=all&per_page=100&page=${page}&labels=squad`
      )
      if (!data.length) break
      issues.push(...data.filter(i => !i.pull_request))
      if (data.length < 100) break
      page++
    } catch (err) {
      log.warn('Failed to fetch issues', { repo: `${owner}/${name}`, page, error: err.message })
      break
    }
  }

  return issues
}

// Fetch all PRs from a single repo
async function fetchAllPRs(owner, name) {
  const prs = []
  let page = 1

  while (page <= 3) {
    try {
      const { data } = await githubFetch(
        `/repos/${owner}/${name}/pulls?state=all&per_page=100&page=${page}`
      )
      if (!data.length) break
      prs.push(...data)
      if (data.length < 100) break
      page++
    } catch (err) {
      log.warn('Failed to fetch PRs', { repo: `${owner}/${name}`, page, error: err.message })
      break
    }
  }

  return prs
}

// Calculate current streak: consecutive days with at least 1 close
function calculateStreak(closeDates) {
  if (!closeDates.length) return 0

  const uniqueDays = [...new Set(closeDates.map(d => d.toISOString().slice(0, 10)))]
    .sort()
    .reverse()

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Streak must include today or yesterday
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1])
    const curr = new Date(uniqueDays[i])
    const diffDays = (prev - curr) / 86400000
    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// Compute per-agent productivity metrics from GitHub data
export async function computeAgentMetrics(fromDate, toDate, agentFilter) {
  // Check cache (only for unfiltered queries)
  if (!fromDate && !toDate && !agentFilter && cache && Date.now() - cacheTime < CACHE_TTL) {
    log.debug('Returning cached agent metrics')
    return cache
  }

  log.info('Computing agent metrics from GitHub data', { from: fromDate, to: toDate, agent: agentFilter })

  const repos = getAllSquadRepos()

  // Initialize metrics for all agents
  const agentMetrics = {}
  for (const [id, meta] of Object.entries(SQUAD_AGENTS)) {
    if (agentFilter && id !== agentFilter) continue
    agentMetrics[id] = {
      role: meta.role,
      repo: meta.repo,
      issuesAssigned: 0,
      issuesClosed: 0,
      prsOpened: 0,
      prsMerged: 0,
      avgCycleTimeHours: 0,
      currentStreak: 0,
      blockedTimeHours: 0,
      _cycleTimes: [],
      _closeDates: [],
    }
  }

  // Issue number → agent mapping for PR linking
  const issueToAgent = new Map()

  // Fetch and process issues from all repos
  for (const repoGithub of repos) {
    const [owner, name] = repoGithub.split('/')
    const issues = await fetchSquadIssues(owner, name)

    for (const issue of issues) {
      const labels = (issue.labels || []).map(l => l.name || l)
      const agent = extractAgent(labels)
      if (!agent || !agentMetrics[agent]) continue

      // Date filtering
      const createdAt = new Date(issue.created_at)
      if (fromDate && createdAt < new Date(fromDate)) continue
      if (toDate && createdAt > new Date(toDate)) continue

      issueToAgent.set(`${repoGithub}#${issue.number}`, agent)

      agentMetrics[agent].issuesAssigned++

      if (issue.state === 'closed') {
        agentMetrics[agent].issuesClosed++

        if (issue.closed_at) {
          const closedAt = new Date(issue.closed_at)
          const cycleHours = (closedAt - createdAt) / (1000 * 60 * 60)
          if (cycleHours >= 0) {
            agentMetrics[agent]._cycleTimes.push(cycleHours)
          }
          agentMetrics[agent]._closeDates.push(closedAt)
        }
      }

      // Blocked time calculation
      const blockedLabels = labels.filter(l => l.startsWith('blocked-by:'))
      if (blockedLabels.length > 0 && issue.state === 'open') {
        const now = new Date()
        const updatedAt = new Date(issue.updated_at)
        // Approximate: blocked since last update (conservative estimate)
        const blockedHours = (now - updatedAt) / (1000 * 60 * 60)
        agentMetrics[agent].blockedTimeHours += Math.round(blockedHours * 10) / 10
      }
    }
  }

  // Fetch and process PRs from all repos
  for (const repoGithub of repos) {
    const [owner, name] = repoGithub.split('/')
    const prs = await fetchAllPRs(owner, name)

    for (const pr of prs) {
      // Date filtering
      const createdAt = new Date(pr.created_at)
      if (fromDate && createdAt < new Date(fromDate)) continue
      if (toDate && createdAt > new Date(toDate)) continue

      // Link PR to agent via: 1) squad label, 2) "Closes #N" body, 3) branch name
      let agent = null

      // Try squad label first
      const prLabels = (pr.labels || []).map(l => l.name || l)
      agent = extractAgent(prLabels)

      // Try "Closes #N" in body
      if (!agent && pr.body) {
        const closeMatch = pr.body.match(/[Cc]loses?\s+#(\d+)/)
        if (closeMatch) {
          agent = issueToAgent.get(`${repoGithub}#${closeMatch[1]}`)
        }
      }

      // Try branch name: squad/{issue-number}-slug
      if (!agent && pr.head?.ref) {
        const branchMatch = pr.head.ref.match(/^squad\/(\d+)-/)
        if (branchMatch) {
          agent = issueToAgent.get(`${repoGithub}#${branchMatch[1]}`)
        }
      }

      if (!agent || !agentMetrics[agent]) continue

      agentMetrics[agent].prsOpened++
      if (pr.merged_at) {
        agentMetrics[agent].prsMerged++
      }
    }
  }

  // Finalize computed fields and strip internal arrays
  for (const [id, metrics] of Object.entries(agentMetrics)) {
    // Avg cycle time (median)
    if (metrics._cycleTimes.length > 0) {
      const sorted = [...metrics._cycleTimes].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
      metrics.avgCycleTimeHours = Math.round(median * 10) / 10
    }

    // Current streak
    metrics.currentStreak = calculateStreak(metrics._closeDates)

    // Round blocked time
    metrics.blockedTimeHours = Math.round(metrics.blockedTimeHours * 10) / 10

    // Clean up internal fields
    delete metrics._cycleTimes
    delete metrics._closeDates
  }

  const now = new Date()
  const result = {
    agents: agentMetrics,
    period: {
      from: fromDate || null,
      to: toDate || null,
    },
    generatedAt: now.toISOString(),
  }

  // Cache unfiltered results
  if (!fromDate && !toDate && !agentFilter) {
    cache = result
    cacheTime = Date.now()
  }

  return result
}

// Store a productivity snapshot in the metrics DB
export async function snapshotAgentProductivity() {
  try {
    const metrics = await computeAgentMetrics()

    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(metrics.agents))
      .digest('hex')
      .slice(0, 16)

    const lastHash = getLatestSnapshotHash(SNAPSHOT_CHANNEL)
    if (hash === lastHash) {
      log.debug('Agent productivity snapshot unchanged, skipping')
      return
    }

    const ts = new Date().toISOString()
    insertSnapshot(SNAPSHOT_CHANNEL, ts, metrics.agents, hash)
    log.info('Agent productivity snapshot saved')
  } catch (err) {
    log.error('Agent productivity snapshot failed', { error: err.message })
  }
}

// Query historical agent productivity snapshots
export function queryProductivityHistory(from, to) {
  return querySnapshots(SNAPSHOT_CHANNEL, from, to, '15m')
}

// Invalidate the in-memory cache
export function clearAgentMetricsCache() {
  cache = null
  cacheTime = 0
}
