import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TeamBoard } from '../TeamBoard'
import { clearConfigCache } from '../../services/config'
import { useStore } from '../../store/store'

const mockConfig = {
  agents: {
    ripley: { emoji: '👩‍🚀', role: 'Lead' },
    dallas: { emoji: '🧑‍✈️', role: 'Frontend Dev' },
    lambert: { emoji: '👩‍🔬', role: 'Backend Dev' },
    kane: { emoji: '🧑‍🔧', role: 'Tester' },
  },
}

const mockIssues = [
  {
    number: 48,
    title: 'Add component tests',
    state: 'open',
    labels: ['squad:kane', 'type:feature'],
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/48',
    repo: 'ffs-squad-monitor',
  },
  {
    number: 50,
    title: 'Another task for kane',
    state: 'open',
    labels: ['squad:kane'],
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/50',
    repo: 'ffs-squad-monitor',
  },
  {
    number: 51,
    title: 'Dallas frontend task',
    state: 'open',
    labels: ['squad:dallas'],
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/51',
    repo: 'ffs-squad-monitor',
  },
  {
    number: 52,
    title: 'Closed issue for ripley',
    state: 'closed',
    labels: ['squad:ripley'],
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/52',
    repo: 'ffs-squad-monitor',
  },
]


const mockBlockedIssues = [
  ...mockIssues,
  {
    number: 60, title: 'Blocked by upstream', state: 'open',
    labels: ['squad:dallas', 'blocked-by:upstream'],
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/60',
    repo: 'ffs-squad-monitor', createdAt: '2026-03-11T10:00:00Z', updatedAt: '2026-03-12T06:00:00Z',
  },
  {
    number: 61, title: 'Blocked by decision', state: 'open',
    labels: ['squad:lambert', 'blocked-by:decision'],
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/61',
    repo: 'ffs-squad-monitor', createdAt: '2026-03-13T08:00:00Z', updatedAt: '2026-03-13T10:00:00Z',
  },
]

const mockAgentsResponse = [
  { id: 'ripley', emoji: '👩‍🚀', role: 'Lead', status: 'idle', lastActivity: null, currentWork: null },
  { id: 'dallas', emoji: '🧑‍✈️', role: 'Frontend Dev', status: 'idle', lastActivity: null, currentWork: null },
  { id: 'lambert', emoji: '👩‍🔬', role: 'Backend Dev', status: 'idle', lastActivity: null, currentWork: null },
  { id: 'kane', emoji: '🧑‍🔧', role: 'Tester', status: 'idle', lastActivity: null, currentWork: null },
]

function mockFetchSuccess() {
  global.fetch = vi.fn((url) => {
    if (typeof url === 'string' && url.includes('/api/config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      })
    }
    if (typeof url === 'string' && url.includes('/api/agents')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAgentsResponse),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockIssues),
    })
  })
}

describe('TeamBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearConfigCache()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Reset store data state but keep actions
    const { fetchIssues, fetchAgents } = useStore.getState()
    useStore.setState({
      agents: [],
      agentsLoading: true,
      agentsError: null,
      issues: [],
      issuesLoading: true,
      issuesError: null,
      fetchIssues, // Preserve actions
      fetchAgents,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearConfigCache()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = render(<TeamBoard />)
    expect(container.querySelector('[class*="animate-shimmer"]')).toBeInTheDocument()
  })

  it('renders team board with all agent names', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Ripley').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Dallas').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Lambert').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Kane').length).toBeGreaterThanOrEqual(1)
  })

  it('shows agent roles', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Lead')).toBeInTheDocument()
    })
    expect(screen.getByText('Frontend Dev')).toBeInTheDocument()
    expect(screen.getByText('Backend Dev')).toBeInTheDocument()
    expect(screen.getByText('Tester')).toBeInTheDocument()
  })

  it('assigns tasks to correct agents from issue labels', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('#48')).toBeInTheDocument()
    })
    expect(screen.getByText('Add component tests')).toBeInTheDocument()
  })

  it('shows idle state for agents with no active tasks', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
    })
    // Wait for agents to load (they have loading: true initially)
    await waitFor(() => {
      const idleTexts = screen.getAllByText(/Idle • No active tasks/)
      expect(idleTexts.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows active agent count in header', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText(/of 4 agents active/)).toBeInTheDocument()
    })
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to load team data/)).toBeInTheDocument()
    })
  })

  it('shows error on HTTP error response', async () => {
    global.fetch = vi.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/config')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        })
      }
      return Promise.resolve({ ok: false, status: 500 })
    })

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to load team data/)).toBeInTheDocument()
    })
  })

  it('renders workload distribution chart', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Workload Distribution')).toBeInTheDocument()
    })
  })

  it('renders refresh button and reloads on click', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
    })
    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getAllByText('Ripley').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByText('Refresh'))
    // Initial mount: 1 fetch (issues) + 1 fetch (config) + 1 fetch (agents) = 3
    // Refresh: 1 fetch (issues) + 1 fetch (config, from cache) + 1 fetch (agents) = 2
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5)
    })
  })

  it('shows queue count for agents with multiple tasks', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('+1')).toBeInTheDocument()
    })
    expect(screen.getByText('more in queue')).toBeInTheDocument()
  })

  it('shows blocked indicator for agents with blocked-by issues', async () => {
    global.fetch = vi.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfig) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBlockedIssues) })
    })
    const { container } = render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
      expect(container.textContent).toMatch(/Blocked/)
    })
  })

  it('shows blocker type for blocked issues', async () => {
    global.fetch = vi.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfig) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBlockedIssues) })
    })
    const { container } = render(<TeamBoard />)
    await waitFor(() => {
      expect(container.textContent).toMatch(/upstream/)
    })
  })

  it('shows blocked duration for blocked agents', async () => {
    global.fetch = vi.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfig) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBlockedIssues) })
    })
    const { container } = render(<TeamBoard />)
    await waitFor(() => {
      expect(container.textContent).toMatch(/\d+[dhm]/)
    })
  })

  it('does not show blocked indicator for agents without blocked issues', async () => {
    mockFetchSuccess()
    render(<TeamBoard />)
    await waitFor(() => { expect(screen.getByText('Team Board')).toBeInTheDocument() })
    await waitFor(() => { expect(screen.getAllByText('Ripley').length).toBeGreaterThanOrEqual(1) })
    expect(screen.queryByText(/Recently blocked/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Blocked >4h/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Blocked >24h/)).not.toBeInTheDocument()
  })

})