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

vi.mock('../event-bus.js', () => {
  const publish = vi.fn()
  return {
    eventBus: {
      publish,
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  }
})

vi.mock('../../api/events.js', () => ({
  fetchEvents: vi.fn(),
}))

vi.mock('../../api/board.js', () => ({
  fetchIssues: vi.fn(),
}))

vi.mock('../../api/usage.js', () => ({
  fetchUsageData: vi.fn(),
}))

import { dataPoller } from '../data-poller.js'
import { eventBus } from '../event-bus.js'
import { fetchEvents } from '../../api/events.js'
import { fetchIssues } from '../../api/board.js'
import { fetchUsageData } from '../../api/usage.js'

describe('DataPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    fetchEvents.mockResolvedValue([])
    fetchIssues.mockResolvedValue([])
    fetchUsageData.mockResolvedValue({
      totalMinutesUsed: 0,
      totalRuns: 0,
      percentage: 0,
    })
  })

  afterEach(() => {
    dataPoller.stop()
    vi.useRealTimers()
  })

  describe('start / stop', () => {
    it('starts polling jobs', async () => {
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      // Should have called all three fetch functions on immediate run
      expect(fetchEvents).toHaveBeenCalled()
      expect(fetchIssues).toHaveBeenCalled()
      expect(fetchUsageData).toHaveBeenCalled()
    })

    it('does not start twice', async () => {
      dataPoller.start()
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      // Each fetcher called only once (from the single start)
      expect(fetchEvents).toHaveBeenCalledTimes(1)
    })

    it('stops all timers on stop', async () => {
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      dataPoller.stop()

      // Advance past all intervals — nothing should fire
      await vi.advanceTimersByTimeAsync(400_000)
      expect(fetchEvents).not.toHaveBeenCalled()
      expect(fetchIssues).not.toHaveBeenCalled()
      expect(fetchUsageData).not.toHaveBeenCalled()
    })
  })

  describe('events channel', () => {
    it('publishes new events on first poll', async () => {
      const events = [
        { id: 'e1', type: 'PushEvent', repo: 'owner/repo', actor: 'user', createdAt: '2026-01-01T00:00:00Z', payload: {} },
      ]
      fetchEvents.mockResolvedValue(events)

      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'events', 'events:new', events
      )
    })

    it('only publishes genuinely new events', async () => {
      const event1 = { id: 'e1', type: 'PushEvent', repo: 'o/r', actor: 'u', createdAt: '2026-01-01T00:00:00Z', payload: {} }
      const event2 = { id: 'e2', type: 'PushEvent', repo: 'o/r', actor: 'u', createdAt: '2026-01-01T00:01:00Z', payload: {} }

      fetchEvents.mockResolvedValue([event1])
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      // Second poll with same + one new event
      fetchEvents.mockResolvedValue([event1, event2])
      await vi.advanceTimersByTimeAsync(30_000)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'events', 'events:new', [event2]
      )
    })

    it('does not publish when no new events', async () => {
      fetchEvents.mockResolvedValue([{ id: 'e1', type: 'PushEvent', repo: 'o/r', actor: 'u', createdAt: '2026-01-01T00:00:00Z', payload: {} }])
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      // Same events on second poll
      await vi.advanceTimersByTimeAsync(30_000)
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'events', 'events:new', expect.anything()
      )
    })
  })

  describe('issues channel', () => {
    it('publishes full snapshot on first poll', async () => {
      const issues = [
        { repoGithub: 'o/r', number: 1, state: 'open', labels: ['bug'], assignees: [], updatedAt: '2026-01-01' },
      ]
      fetchIssues.mockResolvedValue(issues)

      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'issues', 'issues:update',
        expect.objectContaining({ changed: issues, snapshot: issues })
      )
    })

    it('detects new issues', async () => {
      const issue1 = { repoGithub: 'o/r', number: 1, state: 'open', labels: [], assignees: [], updatedAt: '2026-01-01' }
      const issue2 = { repoGithub: 'o/r', number: 2, state: 'open', labels: [], assignees: [], updatedAt: '2026-01-02' }

      fetchIssues.mockResolvedValue([issue1])
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      fetchIssues.mockResolvedValue([issue1, issue2])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'issues', 'issues:update',
        expect.objectContaining({
          changed: [issue2],
          snapshot: [issue1, issue2],
        })
      )
    })

    it('detects removed issues as closed', async () => {
      const issue1 = { repoGithub: 'o/r', number: 1, state: 'open', labels: [], assignees: [], updatedAt: '2026-01-01' }

      fetchIssues.mockResolvedValue([issue1])
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      // Issue gone from open list
      fetchIssues.mockResolvedValue([])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'issues', 'issues:update',
        expect.objectContaining({
          changed: [expect.objectContaining({ number: 1, state: 'closed' })],
          snapshot: [],
        })
      )
    })

    it('does not publish when nothing changed', async () => {
      const issue1 = { repoGithub: 'o/r', number: 1, state: 'open', labels: ['bug'], assignees: ['user'], updatedAt: '2026-01-01' }

      fetchIssues.mockResolvedValue([issue1])
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      // Same data
      fetchIssues.mockResolvedValue([issue1])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'issues', 'issues:update', expect.anything()
      )
    })
  })

  describe('usage channel', () => {
    it('publishes usage on first poll', async () => {
      const usage = { totalMinutesUsed: 100, totalRuns: 50, percentage: 5 }
      fetchUsageData.mockResolvedValue(usage)

      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'usage', 'usage:update', usage
      )
    })

    it('publishes when usage changes', async () => {
      fetchUsageData.mockResolvedValue({ totalMinutesUsed: 100, totalRuns: 50, percentage: 5 })
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      fetchUsageData.mockResolvedValue({ totalMinutesUsed: 120, totalRuns: 55, percentage: 6 })
      await vi.advanceTimersByTimeAsync(300_000)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'usage', 'usage:update',
        expect.objectContaining({ totalMinutesUsed: 120 })
      )
    })

    it('does not publish when usage unchanged', async () => {
      const usage = { totalMinutesUsed: 100, totalRuns: 50, percentage: 5 }
      fetchUsageData.mockResolvedValue(usage)

      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      vi.clearAllMocks()

      // Same values
      await vi.advanceTimersByTimeAsync(300_000)

      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'usage', 'usage:update', expect.anything()
      )
    })
  })

  describe('error handling', () => {
    it('publishes error event and continues on fetch failure', async () => {
      fetchEvents.mockRejectedValue(new Error('Network down'))
      fetchIssues.mockResolvedValue([])
      fetchUsageData.mockResolvedValue({ totalMinutesUsed: 0, totalRuns: 0, percentage: 0 })

      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)

      expect(eventBus.publish).toHaveBeenCalledWith(
        'events', 'events:error',
        expect.objectContaining({ error: 'Network down' })
      )

      // Other pollers still ran
      expect(fetchIssues).toHaveBeenCalled()
      expect(fetchUsageData).toHaveBeenCalled()
    })

    it('recovers after transient error', async () => {
      fetchEvents.mockRejectedValueOnce(new Error('Temporary'))
      fetchEvents.mockResolvedValue([{ id: 'e1', type: 'PushEvent', repo: 'o/r', actor: 'u', createdAt: '2026-01-01', payload: {} }])

      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)

      // First call errored
      expect(eventBus.publish).toHaveBeenCalledWith(
        'events', 'events:error', expect.anything()
      )

      vi.clearAllMocks()

      // Second poll succeeds
      await vi.advanceTimersByTimeAsync(30_000)
      expect(eventBus.publish).toHaveBeenCalledWith(
        'events', 'events:new', expect.anything()
      )
    })
  })

  describe('polling intervals', () => {
    it('polls events every 30 seconds', async () => {
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchEvents).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(30_000)
      expect(fetchEvents).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(30_000)
      expect(fetchEvents).toHaveBeenCalledTimes(3)
    })

    it('polls issues every 60 seconds', async () => {
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchIssues).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchIssues).toHaveBeenCalledTimes(2)
    })

    it('polls usage every 5 minutes', async () => {
      dataPoller.start()
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchUsageData).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(300_000)
      expect(fetchUsageData).toHaveBeenCalledTimes(2)
    })
  })
})
