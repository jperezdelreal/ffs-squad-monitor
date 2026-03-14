import { eventBus } from './event-bus.js'
import { RULES } from './notification-rules.js'
import { getRateLimitStatus } from './github-client.js'
import { getHeartbeatResponse } from '../api/heartbeat.js'
import { fetchIssues } from '../api/board.js'
import { logger } from './logger.js'

const log = logger.child({ component: 'notification-evaluator' })

const EVAL_INTERVAL = 60_000 // Evaluate every 60 seconds

let previousData = null
let evalTimer = null

/**
 * Gather current data from all sources for rule evaluation.
 */
async function gatherCurrentData() {
  const heartbeat = getHeartbeatResponse()
  const rateLimit = getRateLimitStatus()

  let issues = []
  try {
    issues = await fetchIssues('all')
  } catch (err) {
    log.warn('Failed to fetch issues for notification eval', { error: err.message })
  }

  // Events are not easily fetchable server-side without re-calling GitHub,
  // so we evaluate build-failed via event bus subscription instead
  return { heartbeat, rateLimit, issues, events: [] }
}

/**
 * Run all notification rules against current vs previous data.
 * Publishes any resulting notifications to the alerts channel.
 */
async function evaluate() {
  try {
    const currentData = await gatherCurrentData()

    if (!previousData) {
      // First run — just capture baseline
      previousData = currentData
      log.info('Notification evaluator baseline captured')
      return
    }

    for (const rule of RULES) {
      try {
        const notifications = rule.evaluate(currentData, previousData)
        for (const notification of notifications) {
          eventBus.publish('alerts', 'alerts:new', notification)
          log.info('Notification published', {
            rule: rule.name,
            type: notification.type,
            severity: notification.severity,
          })
        }
      } catch (err) {
        log.error('Notification rule failed', { rule: rule.name, error: err.message })
      }
    }

    previousData = currentData
  } catch (err) {
    log.error('Notification evaluation cycle failed', { error: err.message })
  }
}

/**
 * Start the notification evaluator loop.
 */
export function startNotificationEvaluator() {
  log.info('Starting notification evaluator', { interval: `${EVAL_INTERVAL / 1000}s` })

  // Initial evaluation after short delay (let server warm up)
  setTimeout(evaluate, 5_000)

  evalTimer = setInterval(evaluate, EVAL_INTERVAL)
}

/**
 * Stop the notification evaluator.
 */
export function stopNotificationEvaluator() {
  if (evalTimer) {
    clearInterval(evalTimer)
    evalTimer = null
  }
  previousData = null
  log.info('Notification evaluator stopped')
}

// Export for testing
export { evaluate, gatherCurrentData }
