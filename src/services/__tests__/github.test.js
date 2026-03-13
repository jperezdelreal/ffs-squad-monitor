import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock config service before importing github.js
const MOCK_REPOS = [
  { id: 'flora',          owner: 'jperezdelreal', name: 'flora',          color: '#ef4444' },
  { id: 'ComeRosquillas', owner: 'jperezdelreal', name: 'ComeRosquillas', color: '#f59e0b' },
  { id: 'pixel-bounce',   owner: 'jperezdelreal', name: 'pixel-bounce',   color: '#8b5cf6' },
]

vi.mock('../config.js', () => ({
  fetchConfig: vi.fn(async () => ({ repos: MOCK_REPOS })),
  getConfigSync: vi.fn(() => ({ repos: MOCK_REPOS })),
  clearConfigCache: vi.fn(),
}))

import {
  fetchRepoEvents,
  fetchAllRepoEvents,
  fetchRepoIssues,
  fetchAllRepoIssues,
  fetchWorkflowRuns,
  getRepoColor,
} from '../github.js'

describe('github service', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchRepoEvents', () => {
    const fakeEvent = {
      id: '123',
      type: 'PushEvent',
      actor: { login: 'testuser' },
      created_at: '2026-03-12T10:00:00Z',
      payload: { commits: [] },
    }

    it('fetches and maps events from GitHub API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [fakeEvent],
      })

      const result = await fetchRepoEvents('owner', 'repo')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/events?per_page=10',
        expect.objectContaining({
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        })
      )
      expect(result).toEqual([{
        id: '123',
        type: 'PushEvent',
        repo: 'owner/repo',
        actor: 'testuser',
        createdAt: '2026-03-12T10:00:00Z',
        payload: { commits: [] },
      }])
    })

    it('respects custom limit parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      })

      await fetchRepoEvents('owner', 'repo', 25)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/events?per_page=25',
        expect.any(Object)
      )
    })

    it('returns empty array on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })

      const result = await fetchRepoEvents('owner', 'repo')

      expect(result).toEqual([])
      expect(console.warn).toHaveBeenCalled()
    })

    it('returns empty array on 403 rate limit', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403 })

      const result = await fetchRepoEvents('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on 404 not found', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })

      const result = await fetchRepoEvents('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await fetchRepoEvents('owner', 'repo')

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalled()
    })

    it('maps multiple events correctly', async () => {
      const events = [
        { id: '1', type: 'PushEvent', actor: { login: 'a' }, created_at: '2026-01-01T00:00:00Z', payload: {} },
        { id: '2', type: 'IssuesEvent', actor: { login: 'b' }, created_at: '2026-01-02T00:00:00Z', payload: { action: 'opened' } },
      ]
      mockFetch.mockResolvedValue({ ok: true, json: async () => events })

      const result = await fetchRepoEvents('x', 'y')

      expect(result).toHaveLength(2)
      expect(result[0].actor).toBe('a')
      expect(result[1].type).toBe('IssuesEvent')
    })
  })

  describe('fetchAllRepoEvents', () => {
    it('fetches events from all repos and returns sorted, capped at 50', async () => {
      const makeEvent = (id, date) => ({
        id,
        type: 'PushEvent',
        actor: { login: 'user' },
        created_at: date,
        payload: {},
      })

      // Each repo call returns 1 event
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        return Promise.resolve({
          ok: true,
          json: async () => [makeEvent(String(callCount), `2026-03-${String(callCount).padStart(2, '0')}T00:00:00Z`)],
        })
      })

      const result = await fetchAllRepoEvents()

      expect(mockFetch).toHaveBeenCalledTimes(MOCK_REPOS.length)
      expect(result.length).toBeLessThanOrEqual(50)
      // Sorted descending by date
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i - 1].createdAt) >= new Date(result[i].createdAt)).toBe(true)
      }
    })

    it('handles partial failures gracefully', async () => {
      let callIndex = 0
      mockFetch.mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{
            id: String(callIndex),
            type: 'PushEvent',
            actor: { login: 'user' },
            created_at: '2026-03-01T00:00:00Z',
            payload: {},
          }],
        })
      })

      const result = await fetchAllRepoEvents()

      // Should still return events from successful fetches
      expect(result.length).toBe(MOCK_REPOS.length - 1)
    })

    it('caps results at 50 events', async () => {
      // Return 20 events per repo (3 repos × 20 = 60, should cap at 50)
      mockFetch.mockImplementation(() => {
        const events = Array.from({ length: 20 }, (_, i) => ({
          id: String(Math.random()),
          type: 'PushEvent',
          actor: { login: 'user' },
          created_at: `2026-03-12T${String(i).padStart(2, '0')}:00:00Z`,
          payload: {},
        }))
        return Promise.resolve({ ok: true, json: async () => events })
      })

      const result = await fetchAllRepoEvents()

      expect(result).toHaveLength(50)
    })
  })

  describe('fetchRepoIssues', () => {
    it('fetches issues from GitHub API', async () => {
      const issues = [
        { id: 1, title: 'Bug', state: 'open' },
        { id: 2, title: 'Feature', state: 'closed' },
      ]
      mockFetch.mockResolvedValue({ ok: true, json: async () => issues })

      const result = await fetchRepoIssues('owner', 'repo')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues?state=all&per_page=100',
        expect.objectContaining({
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        })
      )
      expect(result).toEqual(issues)
    })

    it('returns empty array on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })

      const result = await fetchRepoIssues('owner', 'repo')

      expect(result).toEqual([])
      expect(console.warn).toHaveBeenCalled()
    })

    it('returns empty array on 403 rate limit', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403 })

      const result = await fetchRepoIssues('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on 404 not found', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })

      const result = await fetchRepoIssues('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'))

      const result = await fetchRepoIssues('owner', 'repo')

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('fetchAllRepoIssues', () => {
    it('fetches issues from all repos with repo labels', async () => {
      const issues = [{ id: 1, title: 'Test' }]
      mockFetch.mockResolvedValue({ ok: true, json: async () => issues })

      const result = await fetchAllRepoIssues()

      expect(mockFetch).toHaveBeenCalledTimes(MOCK_REPOS.length)
      expect(result).toHaveLength(MOCK_REPOS.length)
      for (const entry of result) {
        expect(entry).toHaveProperty('repo')
        expect(entry).toHaveProperty('issues')
        expect(entry.repo).toMatch(/\//)
      }
    })

    it('includes empty arrays for failed repos', async () => {
      let callIdx = 0
      mockFetch.mockImplementation(() => {
        callIdx++
        if (callIdx === 1) {
          return Promise.resolve({ ok: false, status: 500 })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: callIdx, title: 'Issue' }],
        })
      })

      const result = await fetchAllRepoIssues()

      expect(result).toHaveLength(MOCK_REPOS.length)
      // First repo should have empty issues
      const emptyEntry = result.find(r => r.issues.length === 0)
      expect(emptyEntry).toBeDefined()
    })
  })

  describe('fetchWorkflowRuns', () => {
    it('fetches workflow runs from GitHub API', async () => {
      const runs = [
        { id: 1, status: 'completed', conclusion: 'success' },
        { id: 2, status: 'in_progress', conclusion: null },
      ]
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ workflow_runs: runs }),
      })

      const result = await fetchWorkflowRuns('owner', 'repo')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/actions/runs?per_page=30',
        expect.objectContaining({
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        })
      )
      expect(result).toEqual(runs)
    })

    it('returns empty array when workflow_runs is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const result = await fetchWorkflowRuns('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })

      const result = await fetchWorkflowRuns('owner', 'repo')

      expect(result).toEqual([])
      expect(console.warn).toHaveBeenCalled()
    })

    it('returns empty array on 403 rate limit', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403 })

      const result = await fetchWorkflowRuns('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on 404 not found', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })

      const result = await fetchWorkflowRuns('owner', 'repo')

      expect(result).toEqual([])
    })

    it('returns empty array on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      const result = await fetchWorkflowRuns('owner', 'repo')

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('getRepoColor', () => {
    it('returns correct color for known repo name', () => {
      expect(getRepoColor('flora')).toBe('#ef4444')
      expect(getRepoColor('ComeRosquillas')).toBe('#f59e0b')
    })

    it('returns correct color when repo name is part of a path', () => {
      expect(getRepoColor('jperezdelreal/flora')).toBe('#ef4444')
      expect(getRepoColor('some/path/pixel-bounce/thing')).toBe('#8b5cf6')
    })

    it('returns default gray for unknown repo', () => {
      expect(getRepoColor('unknown-repo')).toBe('#6b7280')
    })

    it('returns default gray for empty string', () => {
      expect(getRepoColor('')).toBe('#6b7280')
    })
  })
})
