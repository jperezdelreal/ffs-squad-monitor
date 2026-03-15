import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStore, initialState } from '../../store/store'

// Mock EventSource before importing hook
class MockEventSource {
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 0 // CONNECTING
    this._listeners = {}
    MockEventSource.instances.push(this)
  }
  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = []
    this._listeners[type].push(fn)
  }
  removeEventListener(type, fn) {
    if (!this._listeners[type]) return
    this._listeners[type] = this._listeners[type].filter(l => l !== fn)
  }
  close() {
    this.readyState = 2
  }
  _emit(type, data) {
    const handlers = this._listeners[type] || []
    handlers.forEach(fn => fn({
      type,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      lastEventId: data?.id || '',
    }))
  }
  _triggerError() {
    if (this.onerror) this.onerror(new Event('error'))
  }
}

vi.stubGlobal('EventSource', MockEventSource)

const { useSSE } = await import('../../hooks/useSSE')

describe('useSSE', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockEventSource.instances = []
    // Reset only data state, preserve store actions
    useStore.setState(initialState)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('connects to SSE endpoint with channels query param', () => {
    const { unmount } = renderHook(() => useSSE({ channels: ['heartbeat', 'events'] }))
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('/api/sse?channels=heartbeat,events')
    unmount()
  })

  it('starts with connecting status', () => {
    const { result, unmount } = renderHook(() => useSSE())
    expect(result.current.status).toBe('connecting')
    unmount()
  })

  it('transitions to streaming on connected event', () => {
    const { result, unmount } = renderHook(() => useSSE())
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('connected', { connectionId: 'test-1', channels: ['heartbeat'] })
    })

    expect(result.current.status).toBe('streaming')
    expect(result.current.error).toBeNull()
    unmount()
  })

  it('updates store events via SSE event', () => {
    const { unmount } = renderHook(() => useSSE({ channels: ['events'] }))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('connected', {})
      es._emit('events:snapshot', {
        type: 'events:snapshot',
        data: [{ id: 'e1', type: 'PushEvent' }],
      })
    })

    const state = useStore.getState()
    expect(state.events).toHaveLength(1)
    unmount()
  })

  it('prepends new events to store', () => {
    useStore.setState({ events: [{ id: 'old' }], eventsLoading: false })

    const { unmount } = renderHook(() => useSSE({ channels: ['events'] }))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('connected', {})
      es._emit('events:new', {
        type: 'events:new',
        data: { id: 'new-1', type: 'PushEvent' },
      })
    })

    const state = useStore.getState()
    expect(state.events[0]).toEqual({ id: 'new-1', type: 'PushEvent' })
    expect(state.events[1]).toEqual({ id: 'old' })
    unmount()
  })

  it('updates issues snapshot in store', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderHook(() => useSSE({ channels: ['issues'] }))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('connected', {})
      es._emit('issues:update', {
        type: 'issues:update',
        data: { snapshot: [{ number: 77, title: 'SSE hook' }] },
      })
    })

    const state = useStore.getState()
    expect(state.issues).toEqual([{ number: 77, title: 'SSE hook' }])
    unmount()
  })

  it('updates usage in store', () => {
    const { unmount } = renderHook(() => useSSE({ channels: ['usage'] }))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('connected', {})
      es._emit('usage:update', {
        type: 'usage:update',
        data: { totalTokens: 50000 },
      })
    })

    const state = useStore.getState()
    expect(state.usage).toEqual({ totalTokens: 50000 })
    unmount()
  })

  it('reconnects with exponential backoff on error', () => {
    const { result, unmount } = renderHook(() => useSSE())

    act(() => {
      MockEventSource.instances[0]._triggerError()
    })
    expect(result.current.status).toBe('reconnecting')
    expect(MockEventSource.instances).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(MockEventSource.instances).toHaveLength(2)

    act(() => {
      MockEventSource.instances[1]._triggerError()
    })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(MockEventSource.instances).toHaveLength(2)

    act(() => { vi.advanceTimersByTime(500) })
    expect(MockEventSource.instances).toHaveLength(3)

    unmount()
  })

  it('falls back to polling after 3 consecutive failures', () => {
    const refreshSpy = vi.fn()
    useStore.setState({ refreshAll: refreshSpy })

    const { result, unmount } = renderHook(() => useSSE())

    for (let i = 0; i < 3; i++) {
      act(() => {
        const es = MockEventSource.instances[MockEventSource.instances.length - 1]
        es._triggerError()
      })
      if (i < 2) {
        act(() => { vi.advanceTimersByTime(30_000) })
      }
    }

    expect(result.current.status).toBe('polling')
    expect(useStore.getState().sseStatus).toBe('polling')
    expect(refreshSpy).toHaveBeenCalled()

    unmount()
  })

  it('retries SSE after 60s even in polling fallback', () => {
    const refreshSpy = vi.fn()
    useStore.setState({ refreshAll: refreshSpy })

    const { unmount } = renderHook(() => useSSE())

    for (let i = 0; i < 3; i++) {
      act(() => {
        const es = MockEventSource.instances[MockEventSource.instances.length - 1]
        es._triggerError()
      })
      if (i < 2) {
        act(() => { vi.advanceTimersByTime(30_000) })
      }
    }

    const countBefore = MockEventSource.instances.length

    act(() => { vi.advanceTimersByTime(60_000) })
    expect(MockEventSource.instances.length).toBeGreaterThan(countBefore)

    unmount()
  })

  it('cleans up on unmount with no memory leaks', () => {
    const { unmount } = renderHook(() => useSSE())
    const es = MockEventSource.instances[0]

    unmount()

    expect(es.readyState).toBe(2)
    expect(useStore.getState().sseStatus).toBe('disconnected')
  })

  it('reconnect() resets attempts and creates fresh connection', () => {
    const { result, unmount } = renderHook(() => useSSE())

    act(() => {
      MockEventSource.instances[0]._triggerError()
    })

    const countBefore = MockEventSource.instances.length

    act(() => {
      result.current.reconnect()
    })

    expect(MockEventSource.instances.length).toBeGreaterThan(countBefore)
    expect(result.current.status).toBe('connecting')

    unmount()
  })

  it('uses default channels when none specified', () => {
    const { unmount } = renderHook(() => useSSE())
    expect(MockEventSource.instances[0].url).toBe('/api/sse?channels=heartbeat,events,issues,usage,viewers')
    unmount()
  })

  it('skips malformed event data gracefully', () => {
    const { unmount } = renderHook(() => useSSE({ channels: ['heartbeat'] }))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('connected', {})
    })

    const handlers = es._listeners['heartbeat:update'] || []
    expect(() => {
      handlers.forEach(fn => fn({ type: 'heartbeat:update', data: 'not-json{{{', lastEventId: '' }))
    }).not.toThrow()

    unmount()
  })
})
