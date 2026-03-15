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

    // First events emitted immediately
    expect(heartbeatHandler).toHaveBeenCalledTimes(1)
    expect(eventsHandler).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)

    // Both channels should have emitted twice: immediate + coalesced
    expect(heartbeatHandler).toHaveBeenCalledTimes(2)
    expect(eventsHandler).toHaveBeenCalledTimes(2)
    expect(heartbeatHandler.mock.calls[1][0].data.hb).toBe(4)  // Coalesced last value
    expect(eventsHandler.mock.calls[1][0].data.ev).toBe(4)  // Coalesced last value
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

    // First event emits immediately
    bus.publish('usage', 'update', { tokens: 0 })
    expect(handler).toHaveBeenCalledTimes(1)
    
    // Simulate high load: 99 more events in <1 second
    for (let i = 1; i < 100; i++) {
      bus.publish('usage', 'update', { tokens: i * 100 })
      vi.advanceTimersByTime(10)
    }

    // Still just the first emission
    expect(handler).toHaveBeenCalledTimes(1)

    // Complete debounce (wait 1000ms from last event)
    vi.advanceTimersByTime(1000)

    // Now second emission with last value
    expect(handler).toHaveBeenCalledTimes(2)
    expect(emittedEvents[1].data.tokens).toBe(9900)
  })

  it('should reset debounce timer when new event arrives', async () => {
    bus.on('agents', handler)

    // First event emits immediately
    bus.publish('agents', 'update', { seq: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(emittedEvents[0].data.seq).toBe(1)
    
    // After 800ms, publish another event
    vi.advanceTimersByTime(800)
    expect(handler).toHaveBeenCalledTimes(1) // Still just the first
    
    bus.publish('agents', 'update', { seq: 2 })
    
    // Wait for debounce to complete
    vi.advanceTimersByTime(1000)
    
    // Should emit second event now
    expect(handler).toHaveBeenCalledTimes(2)
    expect(emittedEvents[1].data.seq).toBe(2)
  })

  it('should handle mixed immediate and delayed emissions', async () => {
    bus.on('alerts', handler)

    // First event emits immediately
    bus.publish('alerts', 'new', { id: 1 })
    expect(handler).toHaveBeenCalledTimes(1)

    // Wait for debounce window to reset (>1s)
    vi.advanceTimersByTime(1200)

    // Next event also emits immediately since >1s elapsed
    bus.publish('alerts', 'new', { id: 2 })
    expect(handler).toHaveBeenCalledTimes(2)

    // Burst of 4 more within 1s - these get coalesced
    for (let i = 3; i < 7; i++) {
      bus.publish('alerts', 'new', { id: i })
      vi.advanceTimersByTime(100)
    }

    // Still only 2 emissions (the two immediate ones)
    expect(handler).toHaveBeenCalledTimes(2)

    // Complete burst debounce
    vi.advanceTimersByTime(1000)

    // Now should have 3 emissions total (two immediate + one coalesced)
    expect(handler).toHaveBeenCalledTimes(3)
    expect(emittedEvents[2].data.id).toBe(6) // Last event in burst
  })

  it('should not lose events during channel switching', async () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    
    bus.on('heartbeat', h1)
    bus.on('events', h2)

    // Interleaved rapid events
    bus.publish('heartbeat', 'update', { h: 1 })  // t=0, emits immediately
    vi.advanceTimersByTime(100)
    bus.publish('events', 'new', { e: 1 })  // t=100, emits immediately
    vi.advanceTimersByTime(100)
    bus.publish('heartbeat', 'update', { h: 2 })  // t=200, queued
    vi.advanceTimersByTime(100)
    bus.publish('events', 'new', { e: 2 })  // t=300, queued

    // Both channels have emitted once (immediate)
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)

    // Complete both debounces
    vi.advanceTimersByTime(1000)

    // Each channel has 2 emissions: immediate + coalesced
    expect(h1).toHaveBeenCalledTimes(2)
    expect(h2).toHaveBeenCalledTimes(2)
    expect(h1.mock.calls[1][0].data.h).toBe(2)  // Coalesced heartbeat
    expect(h2.mock.calls[1][0].data.e).toBe(2)  // Coalesced events
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
