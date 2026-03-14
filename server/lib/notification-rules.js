import { logger } from './logger.js'

const log = logger.child({ component: 'notification-rules' })

/**
 * Notification severity levels.
 */
export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success',
}

/**
 * Create a notification object.
 */
function createNotification(type, severity, title, body, link = null) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    title,
    body,
    timestamp: new Date().toISOString(),
    link,
  }
}

/**
 * Rule: Agent blocked — fires when an issue gains a blocked-by:* label.
 * @param {Array} currentIssues - Current open issues
 * @param {Array} previousIssues - Previous open issues snapshot
 * @returns {Array<Object>} notifications
 */
export function checkAgentBlocked(currentIssues, previousIssues) {
  if (!Array.isArray(currentIssues) || !Array.isArray(previousIssues)) return []

  const prevBlockedKeys = new Set()
  for (const issue of previousIssues) {
    const labels = issue.labels || []
    for (const label of labels) {
      if (/^blocked-by:/i.test(label)) {
        prevBlockedKeys.add(`${issue.repo}#${issue.number}:${label}`)
      }
    }
  }

  const notifications = []
  for (const issue of currentIssues) {
    if (issue.state !== 'open') continue
    const labels = issue.labels || []
    for (const label of labels) {
      if (/^blocked-by:/i.test(label)) {
        const key = `${issue.repo}#${issue.number}:${label}`
        if (!prevBlockedKeys.has(key)) {
          const agent = labels.find(l => /^squad:/.test(l))?.replace('squad:', '') || 'Unknown'
          notifications.push(createNotification(
            'agent-blocked',
            SEVERITY.WARNING,
            `${agent} is blocked`,
            `${agent} is blocked on #${issue.number}: ${issue.title}`,
            issue.url,
          ))
        }
      }
    }
  }

  return notifications
}

/**
 * Rule: Heartbeat stale — fires when no heartbeat update for >5 minutes.
 * @param {Object|null} currentHeartbeat - Current heartbeat data
 * @param {Object|null} previousHeartbeat - Previous heartbeat data
 * @param {number} staleThresholdMs - Staleness threshold (default 5 min)
 * @returns {Array<Object>} notifications
 */
export function checkHeartbeatStale(currentHeartbeat, previousHeartbeat, staleThresholdMs = 5 * 60 * 1000) {
  if (!currentHeartbeat?.timestamp) return []

  const age = Date.now() - new Date(currentHeartbeat.timestamp).getTime()
  if (age <= staleThresholdMs) return []

  // Only fire if the previous heartbeat wasn't already stale
  if (previousHeartbeat?.timestamp) {
    const prevAge = Date.now() - new Date(previousHeartbeat.timestamp).getTime()
    if (prevAge > staleThresholdMs) return []
  }

  const minutes = Math.round(age / 60_000)
  return [createNotification(
    'heartbeat-stale',
    SEVERITY.CRITICAL,
    'Ralph heartbeat stale',
    `Ralph heartbeat stale for ${minutes}m`,
  )]
}

/**
 * Rule: Build failed — fires when a workflow run concludes with failure.
 * @param {Array} currentEvents - Current GitHub events
 * @param {Array} previousEvents - Previous events snapshot
 * @returns {Array<Object>} notifications
 */
export function checkBuildFailed(currentEvents, previousEvents) {
  if (!Array.isArray(currentEvents)) return []

  const prevEventIds = new Set(
    (previousEvents || []).map(e => e.id).filter(Boolean)
  )

  const notifications = []
  for (const event of currentEvents) {
    if (prevEventIds.has(event.id)) continue
    // Check for workflow_run events with failure conclusion
    if (event.type === 'WorkflowRunEvent' && event.payload?.workflow_run?.conclusion === 'failure') {
      const run = event.payload.workflow_run
      notifications.push(createNotification(
        'build-failed',
        SEVERITY.CRITICAL,
        `Build failed in ${event.repo || 'unknown'}`,
        `Build failed: ${run.name || 'workflow'} in ${event.repo || 'unknown'}`,
        run.html_url,
      ))
    }
  }

  return notifications
}

/**
 * Rule: Rate limit warning — fires when GitHub API remaining < threshold.
 * @param {Object} rateLimitInfo - { remaining, limit, reset }
 * @param {number} threshold - Warning threshold (default 100)
 * @returns {Array<Object>} notifications
 */
export function checkRateLimitWarning(rateLimitInfo, threshold = 100) {
  if (!rateLimitInfo || rateLimitInfo.remaining == null) return []
  if (rateLimitInfo.remaining >= threshold) return []

  return [createNotification(
    'rate-limit-warning',
    SEVERITY.WARNING,
    'GitHub API rate limit low',
    `GitHub API: ${rateLimitInfo.remaining} requests left`,
  )]
}

/**
 * Rule: Issue spike — fires when >3 issues opened within 5 minutes.
 * @param {Array} currentIssues - Current issues
 * @param {Array} previousIssues - Previous issues snapshot
 * @param {number} windowMs - Time window (default 5 min)
 * @param {number} spikeThreshold - Count threshold (default 3)
 * @returns {Array<Object>} notifications
 */
export function checkIssueSpike(currentIssues, previousIssues, windowMs = 5 * 60 * 1000, spikeThreshold = 3) {
  if (!Array.isArray(currentIssues)) return []

  const prevNumbers = new Set(
    (previousIssues || []).map(i => `${i.repo}#${i.number}`)
  )

  const now = Date.now()
  const newIssues = currentIssues.filter(issue => {
    const key = `${issue.repo}#${issue.number}`
    if (prevNumbers.has(key)) return false
    const created = new Date(issue.createdAt).getTime()
    return now - created < windowMs
  })

  if (newIssues.length <= spikeThreshold) return []

  // Group by repo for better context
  const repos = [...new Set(newIssues.map(i => i.repoLabel || i.repo))]
  return [createNotification(
    'issue-spike',
    SEVERITY.INFO,
    `${newIssues.length} new issues`,
    `${newIssues.length} new issues opened in ${repos.join(', ')}`,
  )]
}

/**
 * Rule: Sprint milestone — fires when X issues are closed today.
 * @param {Array} currentIssues - Current issues (all states)
 * @param {Array} previousIssues - Previous issues snapshot
 * @param {Array} milestones - Milestone thresholds (default [5, 10, 20, 50])
 * @returns {Array<Object>} notifications
 */
export function checkSprintMilestone(currentIssues, previousIssues, milestones = [5, 10, 20, 50]) {
  if (!Array.isArray(currentIssues)) return []

  const today = new Date().toISOString().slice(0, 10)

  const closedToday = currentIssues.filter(issue =>
    issue.state === 'closed' &&
    issue.updatedAt?.startsWith(today)
  ).length

  const prevClosedToday = (previousIssues || []).filter(issue =>
    issue.state === 'closed' &&
    issue.updatedAt?.startsWith(today)
  ).length

  const notifications = []
  for (const milestone of milestones) {
    if (closedToday >= milestone && prevClosedToday < milestone) {
      notifications.push(createNotification(
        'sprint-milestone',
        SEVERITY.SUCCESS,
        `Sprint milestone: ${milestone}`,
        `Sprint milestone: ${milestone} issues closed today`,
      ))
    }
  }

  return notifications
}

/**
 * All notification rules. Each is a pure function:
 * (currentData, previousData) => notification[]
 */
export const RULES = [
  {
    name: 'agent-blocked',
    evaluate: (current, previous) =>
      checkAgentBlocked(current.issues, previous.issues),
  },
  {
    name: 'heartbeat-stale',
    evaluate: (current, previous) =>
      checkHeartbeatStale(current.heartbeat, previous.heartbeat),
  },
  {
    name: 'build-failed',
    evaluate: (current, previous) =>
      checkBuildFailed(current.events, previous.events),
  },
  {
    name: 'rate-limit',
    evaluate: (current, previous) =>
      checkRateLimitWarning(current.rateLimit),
  },
  {
    name: 'issue-spike',
    evaluate: (current, previous) =>
      checkIssueSpike(current.issues, previous.issues),
  },
  {
    name: 'sprint-milestone',
    evaluate: (current, previous) =>
      checkSprintMilestone(current.issues, previous.issues),
  },
]
