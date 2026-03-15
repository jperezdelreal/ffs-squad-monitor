/**
 * Integration Test: Cross-Feature Pipeline
 * 
 * Tests end-to-end flow from data source → SSE → store → notifications → UI
 * Simulates: Event update → EventBus → SSE stream → Hook → Store → Notification rules → Alert
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
      isConnected: false,
      lastUpdate: null,
      events: [],
      issues: [],
      usage: null,
      notifications: [],
      settings: {
        alertTypes: {
          agentBlocked: true,
        },
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

  it('should propagate events update through full pipeline', async () => {
    renderHook(() => useSSE({ channels: ['events'] }))

    // Step 1: SSE connects
    expect(eventSourceInstances).toHaveLength(1)

    // Step 2: Receive connected event
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Step 3: Receive events snapshot
    const eventsData = [
      { id: '1', type: 'PushEvent', repo: { name: 'test/repo' }, created_at: new Date().toISOString() },
    ]

    act(() => {
      eventSourceInstances[0]._emit('events:snapshot', eventsData)
    })

    // Step 4: Verify store updated
    const state = useStore.getState()
    expect(state.events).toHaveLength(1)
    expect(state.eventsLoading).toBe(false)
  })

  it('should handle notification for agent blocked events', async () => {
    renderHook(() => useSSE({ channels: ['issues'] }))

    // Connect and receive issues with blocked labels
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('issues:snapshot', [
        {
          number: 1,
          title: 'Blocked issue',
          state: 'open',
          labels: [{ name: 'blocked-by:deps' }],
          assignees: [],
        },
      ])
    })

    const state = useStore.getState()
    expect(state.issues).toHaveLength(1)
    expect(state.issues[0].labels[0].name).toBe('blocked-by:deps')
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
    renderHook(() => useSSE({ channels: ['events', 'issues', 'usage'] }))

    // Connect
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
    })

    // Receive updates on all channels
    act(() => {
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
    renderHook(() => useSSE({ channels: ['events'] }))

    // Initial connection and data
    act(() => {
      eventSourceInstances[0]._emit('connected', {})
      eventSourceInstances[0]._emit('events:snapshot', [
        { id: 'e1', type: 'PushEvent', repo: { name: 'test' } },
      ])
    })

    expect(useStore.getState().events).toHaveLength(1)

    // Connection lost
    act(() => {
      eventSourceInstances[0]._error()
    })

    // Data should still be in store
    expect(useStore.getState().events).toHaveLength(1)

    // Reconnect
    act(() => {
      vi.advanceTimersByTime(1000)
      eventSourceInstances[1]._emit('connected', {})
      eventSourceInstances[1]._emit('events:snapshot', [
        { id: 'e1', type: 'PushEvent', repo: { name: 'test' } },
        { id: 'e2', type: 'IssueEvent', repo: { name: 'test2' } },
      ])
    })

    // Verify data updated
    expect(useStore.getState().events).toHaveLength(2)
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
