import { EventEmitter } from 'events'
import { logger } from './logger.js'
import { performanceTracker } from './performance-tracker.js'

export const CHANNELS = [
  'heartbeat',
  'events',
  'issues',
  'usage',
  'agents',
  'alerts',
]

const DEBOUNCE_MS = 1000

export class EventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(200)
    this._connections = new Map()
    this._lastEmitTime = new Map()
    this._pendingEvents = new Map()
    this._eventId = 0
    this._log = logger.child({ component: 'event-bus' })
  }

  publish(channel, type, data) {
    if (!CHANNELS.includes(channel)) {
      this._log.warn('Unknown channel', { channel, type })
      return
    }

    const event = {
      id: String(++this._eventId),
      type,
      channel,
      data,
      timestamp: new Date().toISOString(),
    }

    const now = Date.now()
    const lastTime = this._lastEmitTime.get(channel) || 0
    const elapsed = now - lastTime

    if (elapsed >= DEBOUNCE_MS) {
      this._lastEmitTime.set(channel, now)
      this._dispatch(channel, event)
    } else {
      const existing = this._pendingEvents.get(channel)
      if (existing) clearTimeout(existing.timer)

      const delay = DEBOUNCE_MS - elapsed
      const timer = setTimeout(() => {
        this._lastEmitTime.set(channel, Date.now())
        this._pendingEvents.delete(channel)
        this._dispatch(channel, event)
      }, delay)

      this._pendingEvents.set(channel, { event, timer })
    }
  }

  _dispatch(channel, event) {
    this.emit(channel, event)
    this._log.debug('Event dispatched', { channel, type: event.type, id: event.id })
  }

  addConnection(connectionId, channels) {
    this._connections.set(connectionId, {
      channels,
      connectedAt: new Date().toISOString(),
    })
    performanceTracker.setSseConnectionCount(this._connections.size)
    this._log.info('SSE connection added', { connectionId, channels, total: this._connections.size })
  }

  removeConnection(connectionId) {
    this._connections.delete(connectionId)
    performanceTracker.setSseConnectionCount(this._connections.size)
    this._log.info('SSE connection removed', { connectionId, total: this._connections.size })
  }

  get connectionCount() {
    return this._connections.size
  }

  get currentEventId() {
    return this._eventId
  }

  getConnectionInfo() {
    const channelCounts = {}
    for (const ch of CHANNELS) channelCounts[ch] = 0
    for (const [, conn] of this._connections) {
      for (const ch of conn.channels) {
        if (channelCounts[ch] !== undefined) channelCounts[ch]++
      }
    }
    return {
      total: this._connections.size,
      byChannel: channelCounts,
    }
  }

  destroy() {
    for (const [, pending] of this._pendingEvents) {
      clearTimeout(pending.timer)
    }
    this._pendingEvents.clear()
    this._connections.clear()
    this.removeAllListeners()
    this._eventId = 0
    this._lastEmitTime.clear()
  }
}

export const eventBus = new EventBus()