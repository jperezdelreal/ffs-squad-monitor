import { eventBus, CHANNELS } from '../lib/event-bus.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'sse' })

let connectionCounter = 0

export default function sseRoute(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const channelsParam = url.searchParams.get('channels') || ''
  const requested = channelsParam
    .split(',')
    .map(c => c.trim())
    .filter(c => CHANNELS.includes(c))

  if (requested.length === 0) {
    res.status(400).json({
      error: 'No valid channels specified',
      available: CHANNELS,
      usage: '/api/sse?channels=heartbeat,events',
    })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders?.()

  const connectionId = `sse-${++connectionCounter}-${Date.now()}`

  const lastEventId = req.headers['last-event-id']
    ? parseInt(req.headers['last-event-id'], 10)
    : null

  eventBus.addConnection(connectionId, requested)

  res.write(`event: connected\ndata: ${JSON.stringify({
    connectionId,
    channels: requested,
    lastEventId,
    timestamp: new Date().toISOString(),
  })}\n\n`)

  log.info('SSE client connected', { connectionId, channels: requested, lastEventId })

  const listeners = new Map()

  for (const channel of requested) {
    const handler = (event) => {
      if (lastEventId !== null && parseInt(event.id, 10) <= lastEventId) return

      try {
        res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      } catch {
        // Connection closed
      }
    }

    eventBus.on(channel, handler)
    listeners.set(channel, handler)
  }

  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n')
    } catch {
      // Connection closed
    }
  }, 15_000)

  req.on('close', () => {
    clearInterval(keepalive)
    for (const [channel, handler] of listeners) {
      eventBus.removeListener(channel, handler)
    }
    listeners.clear()
    eventBus.removeConnection(connectionId)
    log.info('SSE client disconnected', { connectionId })
  })
}