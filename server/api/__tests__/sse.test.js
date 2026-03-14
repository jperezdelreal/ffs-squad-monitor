import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('../../lib/logger.js', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// vi.mock is hoisted, so we use vi.hoisted to create the mock bus before the mock factory runs
const { mockBus } = vi.hoisted(() => {
  const { EventEmitter } = require('events')
  const bus = new EventEmitter()
  bus._connections = new Map()
  bus.addConnection = vi.fn((id, channels) => {
    bus._connections.set(id, { channels })
  })
  bus.removeConnection = vi.fn((id) => {
    bus._connections.delete(id)
  })
  return { mockBus: bus }
})

vi.mock('../../lib/event-bus.js', () => ({
  eventBus: mockBus,
  CHANNELS: ['heartbeat', 'events', 'issues', 'usage', 'agents', 'alerts'],
}))

import sseRoute from '../sse.js'

function createMockReq(url, headers = {}) {
  const req = new EventEmitter()
  req.url = url
  req.headers = { host: 'localhost:3001', ...headers }
  return req
}

function createMockRes() {
  const chunks = []
  const headers = {}
  const res = {
    statusCode: 200,
    _headers: headers,
    _chunks: chunks,
    setHeader: vi.fn((key, value) => { headers[key] = value }),
    flushHeaders: vi.fn(),
    write: vi.fn((data) => { chunks.push(data) }),
    status: vi.fn(function(code) { this.statusCode = code; return this }),
    json: vi.fn(function(data) { this._jsonBody = data }),
  }
  return res
}

describe('SSE Route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockBus.removeAllListeners()
    mockBus._connections.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('channel validation', () => {
    it('returns 400 when no channels specified', () => {
      const req = createMockReq('/api/sse')
      const res = createMockRes()
      sseRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No valid channels specified',
          available: expect.arrayContaining(['heartbeat', 'events']),
          usage: '/api/sse?channels=heartbeat,events',
        })
      )
    })

    it('returns 400 for invalid channel names', () => {
      const req = createMockReq('/api/sse?channels=bogus,fake')
      const res = createMockRes()
      sseRoute(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('filters out invalid channels but proceeds with valid ones', () => {
      const req = createMockReq('/api/sse?channels=heartbeat,bogus')
      const res = createMockRes()
      sseRoute(req, res)
      expect(res.status).not.toHaveBeenCalledWith(400)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    })
  })

  describe('SSE headers', () => {
    it('sets correct SSE response headers', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
      expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(res.flushHeaders).toHaveBeenCalled()
    })
  })

  describe('connection lifecycle', () => {
    it('sends connected event on initial connection', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      expect(res.write).toHaveBeenCalled()
      const firstWrite = res._chunks[0]
      expect(firstWrite).toContain('event: connected')
    })

    it('registers connection with event bus', () => {
      const req = createMockReq('/api/sse?channels=heartbeat,events')
      const res = createMockRes()
      sseRoute(req, res)
      expect(mockBus.addConnection).toHaveBeenCalledWith(
        expect.any(String),
        ['heartbeat', 'events']
      )
    })

    it('removes connection on request close', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      const connectionId = mockBus.addConnection.mock.calls[0][0]
      req.emit('close')
      expect(mockBus.removeConnection).toHaveBeenCalledWith(connectionId)
    })

    it('removes channel listeners on close', () => {
      const req = createMockReq('/api/sse?channels=heartbeat,events')
      const res = createMockRes()
      sseRoute(req, res)
      expect(mockBus.listenerCount('heartbeat')).toBe(1)
      expect(mockBus.listenerCount('events')).toBe(1)
      req.emit('close')
      expect(mockBus.listenerCount('heartbeat')).toBe(0)
      expect(mockBus.listenerCount('events')).toBe(0)
    })
  })

  describe('event streaming', () => {
    it('formats events as valid SSE with id, event type, and data', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      mockBus.emit('heartbeat', {
        id: '42',
        type: 'heartbeat:update',
        channel: 'heartbeat',
        data: { status: 'running' },
        timestamp: '2026-03-13T10:00:00.000Z',
      })
      const eventChunk = res._chunks[1]
      expect(eventChunk).toContain('id: 42')
      expect(eventChunk).toContain('event: heartbeat:update')
      expect(eventChunk).toContain('data: ')
    })

    it('delivers events to correct channels only', () => {
      const req1 = createMockReq('/api/sse?channels=heartbeat')
      const res1 = createMockRes()
      sseRoute(req1, res1)
      const req2 = createMockReq('/api/sse?channels=events')
      const res2 = createMockRes()
      sseRoute(req2, res2)
      mockBus.emit('heartbeat', {
        id: '1', type: 'heartbeat:update', channel: 'heartbeat',
        data: {}, timestamp: new Date().toISOString(),
      })
      expect(res1._chunks).toHaveLength(2)
      expect(res2._chunks).toHaveLength(1)
    })

    it('handles multi-channel subscriptions', () => {
      const req = createMockReq('/api/sse?channels=heartbeat,events,issues')
      const res = createMockRes()
      sseRoute(req, res)
      mockBus.emit('heartbeat', { id: '1', type: 'heartbeat:update', channel: 'heartbeat', data: {}, timestamp: new Date().toISOString() })
      mockBus.emit('events', { id: '2', type: 'events:new', channel: 'events', data: [], timestamp: new Date().toISOString() })
      mockBus.emit('issues', { id: '3', type: 'issues:update', channel: 'issues', data: {}, timestamp: new Date().toISOString() })
      expect(res._chunks).toHaveLength(4)
    })
  })

  describe('Last-Event-ID replay', () => {
    it('includes lastEventId in connected event', () => {
      const req = createMockReq('/api/sse?channels=heartbeat', { 'last-event-id': '10' })
      const res = createMockRes()
      sseRoute(req, res)
      const connectedData = res._chunks[0]
      expect(connectedData).toContain('"lastEventId":10')
    })

    it('skips events with ID <= Last-Event-ID', () => {
      const req = createMockReq('/api/sse?channels=heartbeat', { 'last-event-id': '5' })
      const res = createMockRes()
      sseRoute(req, res)
      mockBus.emit('heartbeat', { id: '3', type: 'heartbeat:update', channel: 'heartbeat', data: {}, timestamp: new Date().toISOString() })
      expect(res._chunks).toHaveLength(1)
      mockBus.emit('heartbeat', { id: '6', type: 'heartbeat:update', channel: 'heartbeat', data: {}, timestamp: new Date().toISOString() })
      expect(res._chunks).toHaveLength(2)
    })
  })

  describe('keepalive', () => {
    it('sends keepalive comments every 15 seconds', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      const initialChunks = res._chunks.length
      vi.advanceTimersByTime(15_000)
      expect(res._chunks.length).toBe(initialChunks + 1)
      expect(res._chunks[res._chunks.length - 1]).toBe(': keepalive\n\n')
      vi.advanceTimersByTime(15_000)
      expect(res._chunks.length).toBe(initialChunks + 2)
      req.emit('close')
    })

    it('clears keepalive interval on close', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      const chunksBeforeClose = res._chunks.length
      req.emit('close')
      vi.advanceTimersByTime(30_000)
      expect(res._chunks.length).toBe(chunksBeforeClose)
    })
  })

  describe('concurrent connections', () => {
    it('supports multiple independent connections', () => {
      const connections = []
      for (let i = 0; i < 3; i++) {
        const req = createMockReq('/api/sse?channels=heartbeat')
        const res = createMockRes()
        sseRoute(req, res)
        connections.push({ req, res })
      }
      expect(mockBus.addConnection).toHaveBeenCalledTimes(3)
      mockBus.emit('heartbeat', { id: '1', type: 'heartbeat:update', channel: 'heartbeat', data: { status: 'ok' }, timestamp: new Date().toISOString() })
      for (const { res } of connections) {
        expect(res._chunks).toHaveLength(2)
      }
      connections[0].req.emit('close')
      expect(mockBus.removeConnection).toHaveBeenCalledTimes(1)
      mockBus.emit('heartbeat', { id: '2', type: 'heartbeat:update', channel: 'heartbeat', data: {}, timestamp: new Date().toISOString() })
      expect(connections[1].res._chunks).toHaveLength(3)
      expect(connections[2].res._chunks).toHaveLength(3)
      connections[1].req.emit('close')
      connections[2].req.emit('close')
    })
  })

  describe('error resilience', () => {
    it('handles write errors gracefully (closed connection)', () => {
      const req = createMockReq('/api/sse?channels=heartbeat')
      const res = createMockRes()
      sseRoute(req, res)
      res.write.mockImplementation(() => { throw new Error('write after end') })
      expect(() => {
        mockBus.emit('heartbeat', { id: '1', type: 'heartbeat:update', channel: 'heartbeat', data: {}, timestamp: new Date().toISOString() })
      }).not.toThrow()
    })
  })
})