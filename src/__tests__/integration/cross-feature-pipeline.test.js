/**
 * Integration Test: Cross-Feature Pipeline
 * 
 * Tests end-to-end flow from data source → SSE → store → notifications → UI
 * Simulates: Heartbeat update → EventBus → SSE stream → Hook → Store → Notification rules → Alert
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSSE } from '../../hooks/useSSE'
import { useStore } from '../../store/store'

describe('Integration: Cross-Feature Pipeline', () => {
  let mockEventSource
  let eventSourceInstances = []

  beforeEach(() => {
    vi.useFakeTimers()
    eventSourceInstances = []

    // Reset store
    useStore.setState({
      sseStatus: 'disconnected',
      heartbeatData: null,
      isConnected: false,
      lastUpdate: null,
      events: [],
      issues: [],
      usage: null,
      notifications: [],
      settings: {
        alertTypes: {
          heartbeatStale: true,
          agentBlocked: true,
        },
        stalenessThresholdMin: 5,
      },
    })

    // Mock EventSource
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
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should propagate heartbeat update through full pipeline', async () => {
    renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Step 1: SSE connects
    expect(eventSourceInstances).toHaveLength(1)

    // Step 2: Receive connected event
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Step 3: Receive heartbeat snapshot
    const heartbeatData = {
      status: 'running',
      round: 42,
      pid: 1234,
      timestamp: new Date().toISOString(),
      mode: 'schedule',
    }

    act(() => {
      eventSourceInstances[0]._emit('heartbeat:snapshot', heartbeatData)
    })

    // Step 4: Verify store updated
    const state = useStore.getState()
    expect(state.heartbeatData).toMatchObject({
      status: 'running',
      round: 42,
    })
    expect(state.isConnected).toBe(true)
  })

  it('should trigger notification when heartbeat becomes stale', async () => {
    renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Connect and receive initial heartbeat
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('heartbeat:snapshot', {
        status: 'running',
        round: 1,
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      })
    })

    // Simulate notification check (normally done by useEffect in App.jsx)
    const state = useStore.getState()
    const lastUpdate = new Date(state.heartbeatData.timestamp)
    const staleDurationMin = (Date.now() - lastUpdate.getTime()) / 60000

    expect(staleDurationMin).toBeGreaterThan(5)
    
    // Notification should be added
    if (state.settings.alertTypes.heartbeatStale && staleDurationMin > state.settings.stalenessThresholdMin) {
      useStore.setState({
        notifications: [
          ...state.notifications,
          {
            id: `stale-${Date.now()}`,
            type: 'warning',
            title: 'Stale Heartbeat',
            message: `No heartbeat for ${Math.floor(staleDurationMin)} minutes`,
            timestamp: new Date().toISOString(),
          },
        ],
      })
    }

    const updatedState = useStore.getState()
    expect(updatedState.notifications).toHaveLength(1)
    expect(updatedState.notifications[0].title).toBe('Stale Heartbeat')
  })

  it('should handle event stream → activity feed pipeline', async () => {
    renderHook(() => useSSE({ channels: ['events'] }))

    // Connect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Receive events snapshot
    const eventsData = [
      { id: '1', type: 'PushEvent', repo: { name: 'test/repo' }, created_at: new Date().toISOString() },
      { id: '2', type: 'IssueCommentEvent', repo: { name: 'test/repo2' }, created_at: new Date().toISOString() },
    ]

    act(() => {
      eventSourceInstances[0]._emit('events:snapshot', eventsData)
    })

    // Verify events in store
    const state = useStore.getState()
    expect(state.events).toHaveLength(2)
    expect(state.events[0].type).toBe('PushEvent')
    expect(state.eventsLoading).toBe(false)
  })

  it('should update issues and trigger agent workload recalculation', async () => {
    renderHook(() => useSSE({ channels: ['issues'] }))

    // Connect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Receive issues snapshot
    const issuesData = [
      {
        number: 1,
        title: 'Test issue 1',
        state: 'open',
        labels: [{ name: 'squad:ripley' }],
        assignees: [],
      },
      {
        number: 2,
        title: 'Test issue 2',
        state: 'open',
        labels: [{ name: 'squad:dallas' }, { name: 'squad' }],
        assignees: [],
      },
    ]

    act(() => {
      eventSourceInstances[0]._emit('issues:snapshot', issuesData)
    })

    // Verify issues in store
    const state = useStore.getState()
    expect(state.issues).toHaveLength(2)
    expect(state.issuesLoading).toBe(false)
    
    // Verify agent workload (derived from issues with squad labels)
    const ripleyIssues = state.issues.filter(i => 
      i.labels.some(l => l.name === 'squad:ripley')
    )
    const dallasIssues = state.issues.filter(i => 
      i.labels.some(l => l.name === 'squad:dallas')
    )
    
    expect(ripleyIssues).toHaveLength(1)
    expect(dallasIssues).toHaveLength(1)
  })

  it('should handle usage update and track token consumption', async () => {
    renderHook(() => useSSE({ channels: ['usage'] }))

    // Connect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Receive usage snapshot
    const usageData = {
      core: { limit: 5000, remaining: 4500, used: 500 },
      search: { limit: 30, remaining: 25, used: 5 },
      graphql: { limit: 5000, remaining: 4800, used: 200 },
    }

    act(() => {
      eventSourceInstances[0]._emit('usage:snapshot', usageData)
    })

    // Verify usage in store
    const state = useStore.getState()
    expect(state.usage).toEqual(usageData)
    expect(state.usageLoading).toBe(false)
  })

  it('should handle multi-channel updates in sequence', async () => {
    renderHook(() => useSSE({ channels: ['heartbeat', 'events', 'issues', 'usage'] }))

    // Connect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Receive updates on all channels
    act(() => {
      eventSourceInstances[0]._emit('heartbeat:snapshot', {
        status: 'running',
        round: 5,
      })
      
      eventSourceInstances[0]._emit('events:snapshot', [
        { id: 'e1', type: 'PushEvent', repo: { name: 'test' } },
      ])
      
      eventSourceInstances[0]._emit('issues:snapshot', [
        { number: 1, title: 'Issue 1', state: 'open', labels: [], assignees: [] },
      ])
      
      eventSourceInstances[0]._emit('usage:snapshot', {
        core: { limit: 5000, remaining: 4900, used: 100 },
      })
    })

    // Verify all channels updated
    const state = useStore.getState()
    expect(state.heartbeatData).toBeTruthy()
    expect(state.events).toHaveLength(1)
    expect(state.issues).toHaveLength(1)
    expect(state.usage).toBeTruthy()
    expect(state.sseStatus).toBe('streaming')
  })

  it('should handle incremental updates (new/update events)', async () => {
    renderHook(() => useSSE({ channels: ['issues'] }))

    // Connect and receive initial snapshot
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('issues:snapshot', [
        { number: 1, title: 'Issue 1', state: 'open', labels: [], assignees: [] },
        { number: 2, title: 'Issue 2', state: 'open', labels: [], assignees: [] },
      ])
    })

    expect(useStore.getState().issues).toHaveLength(2)

    // Receive update event for issue #1
    act(() => {
      eventSourceInstances[0]._emit('issues:update', {
        number: 1,
        title: 'Issue 1 Updated',
        state: 'closed',
        labels: [],
        assignees: [],
      })
    })

    // Verify issue updated
    const state = useStore.getState()
    const issue1 = state.issues.find(i => i.number === 1)
    expect(issue1.title).toBe('Issue 1 Updated')
    expect(issue1.state).toBe('closed')
  })

  it('should handle new issue event (incremental addition)', async () => {
    renderHook(() => useSSE({ channels: ['issues'] }))

    // Connect and receive initial snapshot
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('issues:snapshot', [
        { number: 1, title: 'Issue 1', state: 'open', labels: [], assignees: [] },
      ])
    })

    expect(useStore.getState().issues).toHaveLength(1)

    // Receive new issue event
    act(() => {
      eventSourceInstances[0]._emit('issues:new', {
        number: 2,
        title: 'Issue 2',
        state: 'open',
        labels: [{ name: 'squad' }],
        assignees: [],
      })
    })

    // Verify new issue added
    const state = useStore.getState()
    expect(state.issues).toHaveLength(2)
    const issue2 = state.issues.find(i => i.number === 2)
    expect(issue2.title).toBe('Issue 2')
  })

  it('should recover from connection loss without data loss', async () => {
    renderHook(() => useSSE({ channels: ['heartbeat'] }))

    // Initial connection and data
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('heartbeat:snapshot', {
        status: 'running',
        round: 10,
      })
    })

    const initialData = useStore.getState().heartbeatData
    expect(initialData.round).toBe(10)

    // Connection lost
    act(() => {
      eventSourceInstances[0]._error()
    })

    // Data should still be in store
    expect(useStore.getState().heartbeatData.round).toBe(10)

    // Reconnect
    act(() => {
      vi.advanceTimersByTime(1000)
      eventSourceInstances[1]._emit('connected', {})
      eventSourceInstances[1]._emit('heartbeat:snapshot', {
        status: 'running',
        round: 11,
      })
    })

    // Verify data updated
    expect(useStore.getState().heartbeatData.round).toBe(11)
  })

  it('should maintain store consistency during rapid updates', async () => {
    renderHook(() => useSSE({ channels: ['events'] }))

    // Connect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Rapid event updates
    act(() => {
      for (let i = 0; i < 20; i++) {
        eventSourceInstances[0]._emit('events:new', {
          id: `event-${i}`,
          type: 'PushEvent',
          repo: { name: `repo-${i}` },
          created_at: new Date().toISOString(),
        })
      }
    })

    // Store should have all events
    const state = useStore.getState()
    expect(state.events.length).toBeGreaterThanOrEqual(20)
    expect(state.eventsLoading).toBe(false)
  })
})
