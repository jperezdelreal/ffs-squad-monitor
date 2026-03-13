import crypto from 'crypto'
import { REPOS, SQUAD_AGENTS } from '../config.js'
import { githubFetch } from './github-client.js'
import {
  insertSnapshot,
  getLatestSnapshotHash,
  upsertDailySummary,
  pruneOldSnapshots,
  querySnapshots,
} from './metrics-db.js'
import { snapshotAgentProductivity } from './agent-metrics.js'
import { logger } from './logger.js'

const log = logger.child({ service: 'snapshot' })

const INTERVALS = {
  issues: 5 * 60 * 1000,
  agents: 5 * 60 * 1000,
  actions: 15 * 60 * 1000,
  agentProductivity: 15 * 60 * 1000,
}

const timers = {}
let lastDailySummaryDate = null

function dataHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)
}

function skipIfUnchanged(channel, data) {
  const hash = dataHash(data)
  const lastHash = getLatestSnapshotHash(channel)
  if (hash === lastHash) {
    log.debug('Snapshot unchanged, skipping', { channel })
    return true
  }
  return false
}

// --- Issue Snapshots ---

async function snapshotIssues() {
  try {
    const counts = { total: 0, open: 0, closed: 0, repos: {} }

    for (const repo of REPOS) {
      const [owner, name] = repo.github.split('/')
      try {
        const { data: openIssues } = await githubFetch(
          `/repos/${owner}/${name}/issues?state=open&per_page=1`
        )
        const { data: closedIssues } = await githubFetch(
          `/repos/${owner}/${name}/issues?state=closed&per_page=1`
        )

        const repoOpen = openIssues.filter(i => !i.pull_request).length
        const repoClosed = closedIssues.filter(i => !i.pull_request).length

        counts.repos[repo.id] = { open: repoOpen, closed: repoClosed }
        counts.open += repoOpen
        counts.closed += repoClosed
      } catch (err) {
        log.warn('Failed to snapshot issues for repo', { repo: repo.id, error: err.message })
      }
    }
    counts.total = counts.open + counts.closed

    if (skipIfUnchanged('issues', counts)) return
    const ts = new Date().toISOString()
    insertSnapshot('issues', ts, counts, dataHash(counts))
    log.info('Issues snapshot saved', { open: counts.open, closed: counts.closed })
  } catch (err) {
    log.error('Issues snapshot failed', { error: err.message })
  }
}

// --- Agent Status Snapshots ---

async function snapshotAgents() {
  try {
    const agentData = {}
    for (const [id, meta] of Object.entries(SQUAD_AGENTS)) {
      agentData[id] = {
        role: meta.role,
        repo: meta.repo,
        status: 'idle',
      }
    }

    // Try to get real agent statuses from the agents API
    try {
      const response = await fetch(`http://localhost:${process.env.PORT || 3001}/api/agents`, {
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        const agents = await response.json()
        for (const agent of agents) {
          if (agentData[agent.id]) {
            agentData[agent.id].status = agent.status || 'idle'
            agentData[agent.id].currentWork = agent.currentWork || null
            agentData[agent.id].lastActivity = agent.lastActivity || null
          }
        }
      }
    } catch {
      // Server might not be fully ready
    }

    const summary = { working: 0, idle: 0, blocked: 0, total: Object.keys(agentData).length }
    for (const agent of Object.values(agentData)) {
      if (agent.status === 'working') summary.working++
      else if (agent.status === 'blocked') summary.blocked++
      else summary.idle++
    }

    const snapshot = { agents: agentData, summary }

    if (skipIfUnchanged('agents', snapshot)) return
    const ts = new Date().toISOString()
    insertSnapshot('agents', ts, snapshot, dataHash(snapshot))
    log.info('Agent snapshot saved', summary)
  } catch (err) {
    log.error('Agent snapshot failed', { error: err.message })
  }
}

// --- GitHub Actions Snapshots ---

async function snapshotActions() {
  try {
    const actionsData = { totalRuns: 0, repos: {} }

    for (const repo of REPOS) {
      const [owner, name] = repo.github.split('/')
      try {
        const { data } = await githubFetch(
          `/repos/${owner}/${name}/actions/runs?per_page=10&status=completed`
        )
        const runs = data.workflow_runs || []
        let durationMs = 0
        for (const run of runs) {
          if (run.created_at && run.updated_at) {
            const d = new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()
            if (d > 0) durationMs += d
          }
        }
        actionsData.repos[repo.id] = {
          runs: runs.length,
          durationMinutes: Math.round(durationMs / 60_000),
        }
        actionsData.totalRuns += runs.length
      } catch (err) {
        log.warn('Failed to snapshot actions for repo', { repo: repo.id, error: err.message })
      }
    }

    if (skipIfUnchanged('actions', actionsData)) return
    const ts = new Date().toISOString()
    insertSnapshot('actions', ts, actionsData, dataHash(actionsData))
    log.info('Actions snapshot saved', { totalRuns: actionsData.totalRuns })
  } catch (err) {
    log.error('Actions snapshot failed', { error: err.message })
  }
}

// --- Daily Summary ---

async function computeDailySummary() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastDailySummaryDate === today) return

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (lastDailySummaryDate === yesterday) return

  try {
    const from = `${yesterday}T00:00:00.000Z`
    const to = `${yesterday}T23:59:59.999Z`

    for (const channel of ['issues', 'agents', 'actions']) {
      const snapshots = querySnapshots(channel, from, to, '5m')
      if (!snapshots.length) continue

      const first = snapshots[0].data
      const last = snapshots[snapshots.length - 1].data
      const summary = {
        snapshotCount: snapshots.length,
        firstSnapshot: first,
        lastSnapshot: last,
      }

      upsertDailySummary(yesterday, channel, summary)
    }

    pruneOldSnapshots()
    lastDailySummaryDate = yesterday
    log.info('Daily summary computed', { date: yesterday })
  } catch (err) {
    log.error('Daily summary computation failed', { error: err.message })
  }
}

// --- Service Lifecycle ---

export function startSnapshotService() {
  log.info('Starting snapshot service', {
    issueInterval: '5m',
    agentInterval: '5m',
    actionsInterval: '15m',
    agentProductivityInterval: '15m',
  })

  // Run initial snapshots after a short delay (let server start)
  setTimeout(() => {
    snapshotIssues()
    snapshotAgents()
    snapshotActions()
    snapshotAgentProductivity()
    computeDailySummary()
  }, 10_000)

  timers.issues = setInterval(snapshotIssues, INTERVALS.issues)
  timers.agents = setInterval(snapshotAgents, INTERVALS.agents)
  timers.actions = setInterval(snapshotActions, INTERVALS.actions)
  timers.agentProductivity = setInterval(snapshotAgentProductivity, INTERVALS.agentProductivity)
  // Check daily summary every hour
  timers.daily = setInterval(computeDailySummary, 60 * 60 * 1000)
}

export function stopSnapshotService() {
  for (const [name, timer] of Object.entries(timers)) {
    clearInterval(timer)
    delete timers[name]
  }
  log.info('Snapshot service stopped')
}

// Export for testing
export { snapshotIssues, snapshotAgents, snapshotActions, computeDailySummary }
