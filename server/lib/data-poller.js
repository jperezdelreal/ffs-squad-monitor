import { eventBus } from './event-bus.js'
import { logger } from './logger.js'
import { fetchEvents } from '../api/events.js'
import { fetchIssues } from '../api/board.js'
import { fetchUsageData } from '../api/usage.js'

const log = logger.child({ component: 'data-poller' })

// Default polling intervals (ms)
const INTERVALS = {
  events: 30_000,   // 30 seconds
  issues: 60_000,   // 60 seconds
  usage: 300_000,   // 5 minutes
}

/**
 * Manages background polling jobs that push data changes to the event bus.
 * Each job: fetch data → diff against last snapshot → publish if changed.
 */
class DataPoller {
  constructor() {
    this._timers = new Map()
    this._lastSnapshots = new Map()
    this._running = false
  }

  start() {
    if (this._running) return
    this._running = true
    log.info('Starting data pollers', { channels: Object.keys(INTERVALS) })

    this._startJob('events', INTERVALS.events, this._pollEvents.bind(this))
    this._startJob('issues', INTERVALS.issues, this._pollIssues.bind(this))
    this._startJob('usage', INTERVALS.usage, this._pollUsage.bind(this))
  }

  stop() {
    if (!this._running) return
    this._running = false

    for (const [name, timer] of this._timers) {
      clearInterval(timer)
      log.debug('Stopped poller', { channel: name })
    }
    this._timers.clear()
    this._lastSnapshots.clear()
    log.info('All data pollers stopped')
  }

  _startJob(name, intervalMs, fn) {
    // Run immediately on start, then on interval
    this._runSafe(name, fn)
    const timer = setInterval(() => this._runSafe(name, fn), intervalMs)
    this._timers.set(name, timer)
    log.info('Poller registered', { channel: name, intervalMs })
  }

  async _runSafe(name, fn) {
    try {
      await fn()
    } catch (err) {
      log.error('Poller error', { channel: name, error: err.message })
      eventBus.publish(name, `${name}:error`, {
        error: err.message,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // --- Channel poll functions ---

  async _pollEvents() {
    const events = await fetchEvents()
    const lastIds = this._lastSnapshots.get('events') || new Set()
    const currentIds = new Set(events.map(e => e.id))

    const newEvents = events.filter(e => !lastIds.has(e.id))

    if (newEvents.length > 0) {
      eventBus.publish('events', 'events:new', newEvents)
      log.debug('New events published', { count: newEvents.length })
    }

    this._lastSnapshots.set('events', currentIds)
  }

  async _pollIssues() {
    const issues = await fetchIssues('open')
    const lastSnapshot = this._lastSnapshots.get('issues')

    // Build a map keyed by repo+number for diffing
    const currentMap = new Map()
    for (const issue of issues) {
      currentMap.set(`${issue.repoGithub}#${issue.number}`, issue)
    }

    if (!lastSnapshot) {
      // First run — store snapshot, publish full state
      this._lastSnapshots.set('issues', currentMap)
      eventBus.publish('issues', 'issues:update', {
        changed: issues,
        snapshot: issues,
      })
      return
    }

    // Detect changes: new issues, state/label changes, closed issues
    const changed = []
    for (const [key, issue] of currentMap) {
      const prev = lastSnapshot.get(key)
      if (!prev) {
        changed.push(issue)
      } else if (
        prev.state !== issue.state ||
        prev.updatedAt !== issue.updatedAt ||
        JSON.stringify(prev.labels) !== JSON.stringify(issue.labels) ||
        JSON.stringify(prev.assignees) !== JSON.stringify(issue.assignees)
      ) {
        changed.push(issue)
      }
    }

    // Detect removed issues (closed since last poll)
    for (const [key] of lastSnapshot) {
      if (!currentMap.has(key)) {
        const prev = lastSnapshot.get(key)
        changed.push({ ...prev, state: 'closed' })
      }
    }

    if (changed.length > 0) {
      eventBus.publish('issues', 'issues:update', {
        changed,
        snapshot: issues,
      })
      log.debug('Issue changes published', { count: changed.length })
    }

    this._lastSnapshots.set('issues', currentMap)
  }

  async _pollUsage() {
    const usage = await fetchUsageData()
    const lastUsage = this._lastSnapshots.get('usage')

    const changed = !lastUsage ||
      lastUsage.totalMinutesUsed !== usage.totalMinutesUsed ||
      lastUsage.totalRuns !== usage.totalRuns ||
      lastUsage.percentage !== usage.percentage

    if (changed) {
      eventBus.publish('usage', 'usage:update', usage)
      log.debug('Usage data published')
    }

    this._lastSnapshots.set('usage', usage)
  }
}

export const dataPoller = new DataPoller()
