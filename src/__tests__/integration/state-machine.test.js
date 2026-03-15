/**
 * Integration Test: SSE Connection State Machine
 * 
 * Tests the complete state machine for SSE connections:
 * disconnected → connecting → streaming → (error) → reconnecting → polling → connecting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSSE } from '../../hooks/useSSE'
import { useStore } from '../../store/store'

describe('Integration: SSE Connection State Machine', () => {
  let mockEventSource
  let eventSourceInstances = []

  beforeEach(() => {
    vi.useFakeTimers()
    eventSourceInstances = []

    useStore.setState({
      sseStatus: 'disconnected',
      heartbeatData: null,
    })

    mockEventSource = class MockEventSource {
      constructor(url) {
        this.url = url
        this.readyState = 1
        this._listeners = {}
        eventSourceInstances.push(this)
      }

      addEventListener(type, handler) {
        if (!this._listeners[type]) this._listeners[type] = []
        this._listeners[type].push(handler)
      }

      close() {
        this.readyState = 2
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
      json: async () => ({}),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should start in connecting state', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    expect(result.current.status).toBe('connecting')
    expect(useStore.getState().sseStatus).toBe('connecting')
  })

  it('should transition to streaming on successful connection', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    expect(result.current.status).toBe('streaming')
    expect(useStore.getState().sseStatus).toBe('streaming')
  })

  it('should transition to reconnecting on first error', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._error()
    })

    expect(result.current.status).toBe('reconnecting')
    expect(useStore.getState().sseStatus).toBe('reconnecting')
  })

  it('should complete full state cycle: connecting → streaming → reconnecting → streaming', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    // Initial: connecting
    expect(result.current.status).toBe('connecting')

    // Connected: streaming
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')

    // Error: reconnecting
    act(() => {
      eventSourceInstances[0]._error()
    })
    expect(result.current.status).toBe('reconnecting')

    // Reconnect after 1s
    act(() => {
      vi.advanceTimersByTime(1000)
      eventSourceInstances[1]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')
  })

  it('should transition to polling after 3 consecutive failures', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    // Failure 1
    act(() => {
      eventSourceInstances[0]._error()
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.status).toBe('reconnecting')

    // Failure 2
    act(() => {
      eventSourceInstances[1]._error()
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.status).toBe('reconnecting')

    // Failure 3
    act(() => {
      eventSourceInstances[2]._error()
    })
    expect(result.current.status).toBe('polling')
    expect(useStore.getState().sseStatus).toBe('polling')
  })

  it('should return from polling to connecting after timeout', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    // Enter polling mode
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

    // After 60s, should retry SSE
    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(result.current.status).toBe('connecting')
  })

  it('should maintain streaming state during active data flow', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    expect(result.current.status).toBe('streaming')

    // Emit 10 heartbeat events
    for (let i = 0; i < 10; i++) {
      act(() => {
        eventSourceInstances[0]._emit('heartbeat:snapshot', {
          status: 'running',
          round: i,
        })
      })
      expect(result.current.status).toBe('streaming')
    }
  })

  it('should reset to connecting after successful reconnection', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    // Initial connection
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')

    // Error
    act(() => {
      eventSourceInstances[0]._error()
    })
    expect(result.current.status).toBe('reconnecting')

    // Successful reconnection
    act(() => {
      vi.advanceTimersByTime(1000)
      eventSourceInstances[1]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')

    // Next error should start fresh at reconnecting (not jump to polling)
    act(() => {
      eventSourceInstances[1]._error()
    })
    expect(result.current.status).toBe('reconnecting')
  })

  it('should expose manual reconnect function', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    expect(result.current.reconnect).toBeInstanceOf(Function)

    // Close initial connection
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0].close()
    })

    const beforeReconnect = eventSourceInstances.length

    // Manual reconnect
    act(() => {
      result.current.reconnect()
    })

    expect(eventSourceInstances.length).toBeGreaterThan(beforeReconnect)
  })

  it('should persist state transitions in store', () => {
    renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    const states = []
    
    // Track state changes
    states.push(useStore.getState().sseStatus)

    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      states.push(useStore.getState().sseStatus)
    })

    act(() => {
      eventSourceInstances[0]._error()
      states.push(useStore.getState().sseStatus)
    })

    expect(states).toEqual(['connecting', 'streaming', 'reconnecting'])
  })

  it('should handle rapid state transitions', () => {
    const { result } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    
    // Rapidly connect and disconnect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')

    act(() => {
      eventSourceInstances[0]._error()
    })
    expect(result.current.status).toBe('reconnecting')

    act(() => {
      vi.advanceTimersByTime(1000)
      eventSourceInstances[1]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')

    act(() => {
      eventSourceInstances[1]._error()
    })
    expect(result.current.status).toBe('reconnecting')

    // Should still be able to recover
    act(() => {
      vi.advanceTimersByTime(1000)
      eventSourceInstances[2]._emit('connected', {})
    })
    expect(result.current.status).toBe('streaming')
  })
})
