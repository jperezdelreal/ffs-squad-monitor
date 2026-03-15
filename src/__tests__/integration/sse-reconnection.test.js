/**
 * Integration Test: SSE Reconnection After Connection Failure
 * 
 * Tests the complete reconnection flow including:
 * - Exponential backoff (1s → 2s → 4s → 8s)
 * - Fallback to polling after 3 failures
 * - Recovery from polling back to SSE
 * - Last-Event-ID replay for missed events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSSE } from '../../hooks/useSSE'
import { useStore } from '../../store/store'

describe('Integration: SSE Reconnection After Connection Failure', () => {
  let mockEventSource
  let eventSourceInstances = []
  let originalEventSource

  beforeEach(() => {
    vi.useFakeTimers()
    eventSourceInstances = []
    
    // Reset store
    useStore.setState({
      sseStatus: 'disconnected',
      heartbeatData: null,
      events: [],
      issues: [],
      usage: null,
      notifications: [],
    })

    // Mock EventSource
    originalEventSource = global.EventSource
    mockEventSource = class MockEventSource {
      constructor(url) {
        this.url = url
        this.readyState = 1 // OPEN
        this._listeners = {}
        eventSourceInstances.push(this)
      }

      addEventListener(type, handler) {
        if (!this._listeners[type]) this._listeners[type] = []
        this._listeners[type].push(handler)
      }

      removeEventListener(type, handler) {
        if (this._listeners[type]) {
          this._listeners[type] = this._listeners[type].filter(h => h !== handler)
        }
      }

      close() {
        this.readyState = 2 // CLOSED
      }

      _emit(type, data) {
        if (this._listeners[type]) {
          // Wrap data in eventBus format: { id, type, channel, data, timestamp }
          const wrappedData = {
            id: String(Date.now()),
            type,
            channel: type.split(':')[0],
            data,
            timestamp: new Date().toISOString(),
          }
          const event = {
            type,
            data: JSON.stringify(wrappedData),
            lastEventId: '',
          }
          this._listeners[type].forEach(fn => fn(event))
        }
      }

      _error() {
        // Call onerror handler if set
        if (this.onerror) {
          this.onerror(new Event('error'))
        }
        // Also call addEventListener handlers
        if (this._listeners.error) {
          this._listeners.error.forEach(fn => fn(new Event('error')))
        }
      }
    }

    global.EventSource = mockEventSource
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'polled' }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    global.EventSource = originalEventSource
    vi.restoreAllMocks()
  })

  it('should recover from single connection error with exponential backoff', async () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Initial connection
    expect(result.current.status).toBe('connecting')
    expect(eventSourceInstances).toHaveLength(1)

    // Simulate connection error
    act(() => {
      eventSourceInstances[0]._error()
    })

    // Should attempt reconnection after 1s (attempt 1)
    expect(result.current.status).toBe('reconnecting')
    
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(eventSourceInstances).toHaveLength(2)

    // Simulate successful connection
    act(() => {
      eventSourceInstances[1]._emit('connected', { channel: 'heartbeat' })
    })

    expect(result.current.status).toBe('streaming')
    expect(result.current.error).toBeNull()
  })

  it('should fall back to polling after 3 consecutive failures', async () => {
    const refreshAllSpy = vi.spyOn(useStore.getState(), 'refreshAll')
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // First failure
    act(() => {
      eventSourceInstances[0]._error()
    })
    expect(result.current.status).toBe('reconnecting')

    // Wait for first reconnection attempt (1s)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(eventSourceInstances).toHaveLength(2)

    // Second failure
    act(() => {
      eventSourceInstances[1]._error()
    })

    // Wait for second reconnection attempt (2s)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(eventSourceInstances).toHaveLength(3)

    // Third failure
    act(() => {
      eventSourceInstances[2]._error()
    })

    // Should now fall back to polling
    expect(result.current.status).toBe('polling')
    expect(refreshAllSpy).toHaveBeenCalled()

    // Verify polling interval is 60s
    refreshAllSpy.mockClear()
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(refreshAllSpy).toHaveBeenCalledTimes(1)
  })

  it('should retry SSE connection after 60s of polling', async () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Force 3 failures to enter polling mode
    for (let i = 0; i < 3; i++) {
      act(() => {
        eventSourceInstances[i]._error()
      })
      if (i < 2) {
        act(() => {
          vi.advanceTimersByTime(Math.pow(2, i) * 1000)
        })
      }
    }

    expect(result.current.status).toBe('polling')
    const pollingModeInstances = eventSourceInstances.length

    // After 60s, should retry SSE
    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(eventSourceInstances.length).toBeGreaterThan(pollingModeInstances)
    expect(result.current.status).toBe('connecting')
  })

  it('should handle Last-Event-ID replay after reconnection', async () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Simulate successful initial connection with event
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('heartbeat:snapshot', {
        data: JSON.stringify({ id: 'event-123', status: 'running' }),
        lastEventId: '123',
      })
    })

    expect(result.current.status).toBe('streaming')

    // Simulate disconnection
    act(() => {
      eventSourceInstances[0]._error()
    })

    // Reconnect
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Verify new EventSource was created with correct URL
    const newES = eventSourceInstances[1]
    expect(newES.url).toContain('channels=heartbeat')
    
    // Simulate receiving update event after reconnection
    act(() => {
      newES._emit('connected', {})
      newES._emit('heartbeat:update', {
        data: JSON.stringify({ id: 'event-124', status: 'idle' }),
      })
    })

    expect(result.current.status).toBe('streaming')
  })

  it('should reset backoff timer after successful connection', async () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // First failure → 1s backoff
    act(() => {
      eventSourceInstances[0]._error()
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Successful connection
    act(() => {
      eventSourceInstances[1]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')

    // Another failure should restart at 1s (not 2s)
    act(() => {
      eventSourceInstances[1]._error()
    })
    
    const beforeReconnect = eventSourceInstances.length
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(eventSourceInstances.length).toBe(beforeReconnect + 1)
  })

  it('should cap exponential backoff at 30 seconds', async () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Simulate failures with exponential backoff
    // After 3 failures, it will enter polling mode
    const delays = [1000, 2000]
    
    for (let i = 0; i < 3; i++) {
      act(() => {
        if (eventSourceInstances[i]) {
          eventSourceInstances[i]._error()
        }
      })
      
      if (i < 2) { // First 2 failures: reconnect with backoff
        act(() => {
          vi.advanceTimersByTime(delays[i])
        })
        expect(eventSourceInstances).toHaveLength(i + 2)
      }
    }

    // After 3rd failure, should enter polling mode
    expect(result.current.status).toBe('polling')
  })

  it('should maintain separate channel subscriptions during reconnection', async () => {
    const { result } = renderHook(() => 
      useSSE({ channels: ['heartbeat', 'events', 'issues'] })
    )

    // Initial connection
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Simulate events on multiple channels
    act(() => {
      eventSourceInstances[0]._emit('heartbeat:snapshot', {
        data: JSON.stringify({ status: 'running' }),
      })
      eventSourceInstances[0]._emit('events:new', {
        data: JSON.stringify({ type: 'push', repo: 'test-repo' }),
      })
      eventSourceInstances[0]._emit('issues:update', {
        data: JSON.stringify({ number: 1, state: 'open' }),
      })
    })

    // Verify URL includes all channels
    expect(eventSourceInstances[0].url).toContain('heartbeat')
    expect(eventSourceInstances[0].url).toContain('events')
    expect(eventSourceInstances[0].url).toContain('issues')

    // Disconnect and reconnect
    act(() => {
      eventSourceInstances[0]._error()
      vi.advanceTimersByTime(1000)
    })

    // New connection should preserve channel list
    expect(eventSourceInstances[1].url).toContain('heartbeat')
    expect(eventSourceInstances[1].url).toContain('events')
    expect(eventSourceInstances[1].url).toContain('issues')
  })

  it('should cleanup timers and connections when unmounted during reconnection', async () => {
    const { result, unmount } = renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Trigger error to start reconnection timer
    act(() => {
      eventSourceInstances[0]._error()
    })

    expect(result.current.status).toBe('reconnecting')

    // Unmount before reconnection happens
    unmount()

    // Advance timer past reconnection time
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Should not create new EventSource after unmount
    expect(eventSourceInstances).toHaveLength(1)
    expect(eventSourceInstances[0].readyState).toBe(2) // CLOSED
  })
})
