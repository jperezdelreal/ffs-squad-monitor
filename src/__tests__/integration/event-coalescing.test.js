/**
 * Integration Test: Event Coalescing Under Load
 * 
 * Tests the EventBus debouncing mechanism when receiving
 * rapid bursts of events. Verifies only the last event
 * in a 1-second window is emitted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventBus } from '../../../server/lib/event-bus'

describe('Integration: Event Coalescing Under Load', () => {
  let bus
  let handler
  let emittedEvents

  beforeEach(() => {
    vi.useFakeTimers()
    bus = new EventBus()
    emittedEvents = []
    handler = vi.fn((event) => {
      emittedEvents.push(event)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    bus.removeAllListeners()
  })

  it('should coalesce 10 rapid events into single emission', async () => {
    bus.on('heartbeat', handler)

    // Publish 10 events within 500ms window
    for (let i = 0; i < 10; i++) {
      bus.publish('heartbeat', 'update', { sequence: i, status: 'running' })
      vi.advanceTimersByTime(50)
    }

    // Only last event should be emitted after debounce period
    expect(handler).toHaveBeenCalledTimes(0) // Still pending

    // Complete the debounce window
    vi.advanceTimersByTime(500)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(emittedEvents[0].data.sequence).toBe(9)
  })

  it('should emit immediately when events are >1s apart', async () => {
    bus.on('heartbeat', handler)

    bus.publish('heartbeat', 'update', { sequence: 1 })
    expect(handler).toHaveBeenCalledTimes(1)

    // Wait 1.5 seconds
    vi.advanceTimersByTime(1500)

    bus.publish('heartbeat', 'update', { sequence: 2 })
    expect(handler).toHaveBeenCalledTimes(2)
    expect(emittedEvents[1].data.sequence).toBe(2)
  })

  it('should handle burst → pause → burst pattern', async () => {
    bus.on('events', handler)

    // First burst: 5 events in 200ms
    for (let i = 0; i < 5; i++) {
      bus.publish('events', 'new', { id: i })
      vi.advanceTimersByTime(40)
    }

    vi.advanceTimersByTime(800) // Complete debounce
    expect(handler).toHaveBeenCalledTimes(1)
    expect(emittedEvents[0].data.id).toBe(4)

    // Pause for 2 seconds
    vi.advanceTimersByTime(2000)

    // Second burst: 3 events in 150ms
    for (let i = 10; i < 13; i++) {
      bus.publish('events', 'new', { id: i })
      vi.advanceTimersByTime(50)
    }

    vi.advanceTimersByTime(850)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(emittedEvents[1].data.id).toBe(12)
  })

  it('should debounce per-channel independently', async () => {
    const heartbeatHandler = vi.fn()
    const eventsHandler = vi.fn()
    
    bus.on('heartbeat', heartbeatHandler)
    bus.on('events', eventsHandler)

    // Rapid updates on both channels simultaneously
    for (let i = 0; i < 5; i++) {
      bus.publish('heartbeat', 'update', { hb: i })
      bus.publish('events', 'new', { ev: i })
      vi.advanceTimersByTime(100)
    }

    vi.advanceTimersByTime(600)

    // Both channels should emit once with their last value
    expect(heartbeatHandler).toHaveBeenCalledTimes(1)
    expect(eventsHandler).toHaveBeenCalledTimes(1)
    expect(heartbeatHandler.mock.calls[0][0].data.hb).toBe(4)
    expect(eventsHandler.mock.calls[0][0].data.ev).toBe(4)
  })

  it('should preserve event metadata (id, timestamp, type)', async () => {
    bus.on('issues', handler)

    bus.publish('issues', 'update', { number: 42 })
    vi.advanceTimersByTime(1100)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = emittedEvents[0]
    
    expect(event).toHaveProperty('id')
    expect(event).toHaveProperty('timestamp')
    expect(event).toHaveProperty('type', 'update')
    expect(event).toHaveProperty('channel', 'issues')
    expect(event.data).toEqual({ number: 42 })
  })

  it('should assign sequential event IDs across all channels', async () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    
    bus.on('heartbeat', h1)
    bus.on('events', h2)

    bus.publish('heartbeat', 'update', { a: 1 })
    vi.advanceTimersByTime(1100)
    
    bus.publish('events', 'new', { b: 2 })
    vi.advanceTimersByTime(1100)

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)

    const id1 = parseInt(h1.mock.calls[0][0].id, 10)
    const id2 = parseInt(h2.mock.calls[0][0].id, 10)
    
    expect(id2).toBe(id1 + 1)
  })

  it('should handle 100 concurrent events within 1 second', async () => {
    bus.on('usage', handler)

    // Simulate high load: 100 events in 1 second
    for (let i = 0; i < 100; i++) {
      bus.publish('usage', 'update', { tokens: i * 100 })
      vi.advanceTimersByTime(10)
    }

    // Should still be pending
    expect(handler).toHaveBeenCalledTimes(0)

    // Complete debounce
    vi.advanceTimersByTime(100)

    // Only 1 emission with last value
    expect(handler).toHaveBeenCalledTimes(1)
    expect(emittedEvents[0].data.tokens).toBe(9900)
  })

  it('should reset debounce timer when new event arrives', async () => {
    bus.on('agents', handler)

    bus.publish('agents', 'update', { seq: 1 })
    
    // After 800ms, publish another event
    vi.advanceTimersByTime(800)
    expect(handler).toHaveBeenCalledTimes(0)
    
    bus.publish('agents', 'update', { seq: 2 })
    
    // Wait another 900ms (total 1700ms from first event)
    vi.advanceTimersByTime(900)
    
    // Should emit now with second event
    expect(handler).toHaveBeenCalledTimes(1)
    expect(emittedEvents[0].data.seq).toBe(2)
  })

  it('should handle mixed immediate and delayed emissions', async () => {
    bus.on('alerts', handler)

    // Immediate (first event)
    bus.publish('alerts', 'new', { id: 1 })
    expect(handler).toHaveBeenCalledTimes(1)

    // Wait for debounce window to reset
    vi.advanceTimersByTime(1200)

    // Burst of 5
    for (let i = 2; i < 7; i++) {
      bus.publish('alerts', 'new', { id: i })
      vi.advanceTimersByTime(100)
    }

    // Still only 1 emission (immediate one)
    expect(handler).toHaveBeenCalledTimes(1)

    // Complete burst debounce
    vi.advanceTimersByTime(600)

    // Now should have 2 emissions total
    expect(handler).toHaveBeenCalledTimes(2)
    expect(emittedEvents[1].data.id).toBe(6)
  })

  it('should not lose events during channel switching', async () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    
    bus.on('heartbeat', h1)
    bus.on('events', h2)

    // Interleaved rapid events
    bus.publish('heartbeat', 'update', { h: 1 })
    vi.advanceTimersByTime(100)
    bus.publish('events', 'new', { e: 1 })
    vi.advanceTimersByTime(100)
    bus.publish('heartbeat', 'update', { h: 2 })
    vi.advanceTimersByTime(100)
    bus.publish('events', 'new', { e: 2 })
    vi.advanceTimersByTime(100)

    // Complete both debounces
    vi.advanceTimersByTime(700)

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
    expect(h1.mock.calls[0][0].data.h).toBe(2)
    expect(h2.mock.calls[0][0].data.e).toBe(2)
  })

  it('should clear pending event when immediate emission happens', async () => {
    bus.on('issues', handler)

    // First event (immediate)
    bus.publish('issues', 'update', { seq: 1 })
    expect(handler).toHaveBeenCalledTimes(1)

    // Rapid burst within 500ms
    vi.advanceTimersByTime(200)
    bus.publish('issues', 'update', { seq: 2 })
    vi.advanceTimersByTime(100)
    bus.publish('issues', 'update', { seq: 3 })
    
    // Wait for debounce
    vi.advanceTimersByTime(800)
    
    // Should have 2 emissions: immediate + debounced
    expect(handler).toHaveBeenCalledTimes(2)
    expect(emittedEvents[1].data.seq).toBe(3)

    // Wait past debounce window
    vi.advanceTimersByTime(1200)

    // Next event should be immediate again
    bus.publish('issues', 'update', { seq: 4 })
    expect(handler).toHaveBeenCalledTimes(3)
    expect(emittedEvents[2].data.seq).toBe(4)
  })
})
