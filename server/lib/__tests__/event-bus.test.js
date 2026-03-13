import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../logger.js', () => ({
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

import { EventBus, CHANNELS, eventBus } from '../event-bus.js'

describe('CHANNELS', () => {
  it('exports all expected channel names', () => {
    expect(CHANNELS).toContain('heartbeat')
    expect(CHANNELS).toContain('events')
    expect(CHANNELS).toContain('issues')
    expect(CHANNELS).toContain('usage')
    expect(CHANNELS).toContain('agents')
    expect(CHANNELS).toContain('alerts')
    expect(CHANNELS).toHaveLength(6)
  })
})

describe('EventBus', () => {
  let bus

  beforeEach(() => {
    vi.useFakeTimers()
    bus = new EventBus()
  })

  afterEach(() => {
    bus.destroy()
    vi.useRealTimers()
  })

  describe('publish / subscribe', () => {
    it('emits event on valid channel', () => {
      const handler = vi.fn()
      bus.on('heartbeat', handler)
      bus.publish('heartbeat', 'heartbeat:update', { status: 'running' })
      expect(handler).toHaveBeenCalledOnce()
      const event = handler.mock.calls[0][0]
      expect(event.type).toBe('heartbeat:update')
      expect(event.channel).toBe('heartbeat')
      expect(event.data).toEqual({ status: 'running' })
      expect(event.id).toBe('1')
      expect(event.timestamp).toBeTruthy()
    })

    it('ignores publish to unknown channel', () => {
      const handler = vi.fn()
      bus.on('unknown', handler)
      bus.publish('unknown', 'unknown:event', {})
      expect(handler).not.toHaveBeenCalled()
    })

    it('increments event IDs', () => {
      const handler = vi.fn()
      bus.on('heartbeat', handler)
      bus.publish('heartbeat', 'heartbeat:update', { round: 1 })
      vi.advanceTimersByTime(1100)
      bus.publish('heartbeat', 'heartbeat:update', { round: 2 })
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler.mock.calls[0][0].id).toBe('1')
      expect(handler.mock.calls[1][0].id).toBe('2')
    })

    it('publishes to multiple channels independently', () => {
      const hbHandler = vi.fn()
      const alertHandler = vi.fn()
      bus.on('heartbeat', hbHandler)
      bus.on('alerts', alertHandler)
      bus.publish('heartbeat', 'heartbeat:update', { status: 'idle' })
      bus.publish('alerts', 'alerts:new', { message: 'test' })
      expect(hbHandler).toHaveBeenCalledOnce()
      expect(alertHandler).toHaveBeenCalledOnce()
    })
  })

  describe('rate limiting (debounce)', () => {
    it('debounces rapid events on same channel', () => {
      const handler = vi.fn()
      bus.on('heartbeat', handler)
      bus.publish('heartbeat', 'heartbeat:update', { round: 1 })
      expect(handler).toHaveBeenCalledOnce()
      bus.publish('heartbeat', 'heartbeat:update', { round: 2 })
      expect(handler).toHaveBeenCalledOnce()
      vi.advanceTimersByTime(1100)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler.mock.calls[1][0].data.round).toBe(2)
    })

    it('coalesces multiple rapid events - only last fires', () => {
      const handler = vi.fn()
      bus.on('heartbeat', handler)
      bus.publish('heartbeat', 'heartbeat:update', { round: 1 })
      bus.publish('heartbeat', 'heartbeat:update', { round: 2 })
      bus.publish('heartbeat', 'heartbeat:update', { round: 3 })
      vi.advanceTimersByTime(1100)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler.mock.calls[1][0].data.round).toBe(3)
    })

    it('does not debounce across different channels', () => {
      const hbHandler = vi.fn()
      const alertHandler = vi.fn()
      bus.on('heartbeat', hbHandler)
      bus.on('alerts', alertHandler)
      bus.publish('heartbeat', 'heartbeat:update', { status: 'running' })
      bus.publish('alerts', 'alerts:new', { message: 'alert' })
      expect(hbHandler).toHaveBeenCalledOnce()
      expect(alertHandler).toHaveBeenCalledOnce()
    })

    it('allows events after debounce period expires', () => {
      const handler = vi.fn()
      bus.on('heartbeat', handler)
      bus.publish('heartbeat', 'heartbeat:update', { round: 1 })
      vi.advanceTimersByTime(1100)
      bus.publish('heartbeat', 'heartbeat:update', { round: 2 })
      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('connection tracking', () => {
    it('tracks connections and provides count', () => {
      expect(bus.connectionCount).toBe(0)
      bus.addConnection('conn-1', ['heartbeat', 'events'])
      expect(bus.connectionCount).toBe(1)
      bus.addConnection('conn-2', ['alerts'])
      expect(bus.connectionCount).toBe(2)
    })

    it('removes connections', () => {
      bus.addConnection('conn-1', ['heartbeat'])
      bus.addConnection('conn-2', ['events'])
      expect(bus.connectionCount).toBe(2)
      bus.removeConnection('conn-1')
      expect(bus.connectionCount).toBe(1)
      bus.removeConnection('conn-2')
      expect(bus.connectionCount).toBe(0)
    })

    it('handles removing non-existent connection gracefully', () => {
      expect(() => bus.removeConnection('nonexistent')).not.toThrow()
    })
  })

  describe('getConnectionInfo', () => {
    it('returns channel breakdown', () => {
      bus.addConnection('conn-1', ['heartbeat', 'events'])
      bus.addConnection('conn-2', ['heartbeat', 'alerts'])
      bus.addConnection('conn-3', ['events'])
      const info = bus.getConnectionInfo()
      expect(info.total).toBe(3)
      expect(info.byChannel.heartbeat).toBe(2)
      expect(info.byChannel.events).toBe(2)
      expect(info.byChannel.alerts).toBe(1)
      expect(info.byChannel.issues).toBe(0)
      expect(info.byChannel.usage).toBe(0)
      expect(info.byChannel.agents).toBe(0)
    })

    it('returns zeros when no connections', () => {
      const info = bus.getConnectionInfo()
      expect(info.total).toBe(0)
      for (const ch of CHANNELS) {
        expect(info.byChannel[ch]).toBe(0)
      }
    })
  })

  describe('currentEventId', () => {
    it('tracks current event ID', () => {
      expect(bus.currentEventId).toBe(0)
      bus.publish('heartbeat', 'heartbeat:update', {})
      expect(bus.currentEventId).toBe(1)
      vi.advanceTimersByTime(1100)
      bus.publish('events', 'events:new', {})
      expect(bus.currentEventId).toBe(2)
    })
  })

  describe('destroy', () => {
    it('clears all state', () => {
      bus.addConnection('conn-1', ['heartbeat'])
      bus.publish('heartbeat', 'heartbeat:update', {})
      bus.destroy()
      expect(bus.connectionCount).toBe(0)
      expect(bus.currentEventId).toBe(0)
      expect(bus.listenerCount('heartbeat')).toBe(0)
    })

    it('clears pending debounce timers', () => {
      const handler = vi.fn()
      bus.on('heartbeat', handler)
      bus.publish('heartbeat', 'heartbeat:update', { round: 1 })
      bus.publish('heartbeat', 'heartbeat:update', { round: 2 })
      bus.destroy()
      vi.advanceTimersByTime(2000)
      expect(handler).toHaveBeenCalledOnce()
    })
  })
})

describe('eventBus singleton', () => {
  it('exports a singleton EventBus instance', () => {
    expect(eventBus).toBeInstanceOf(EventBus)
  })
})