import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TeamBoard } from '../TeamBoard'

vi.mock('../../services/config', () => ({
  fetchConfig: vi.fn(),
}))

vi.mock('../../services/mockData', () => ({
  getAgentWorkload: vi.fn(() => [
    { agent: 'ripley', count: 0, label: 'Ripley' },
  ]),
}))

import { fetchConfig } from '../../services/config'
import { getAgentWorkload } from '../../services/mockData'

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

describe('TeamBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchConfig.mockResolvedValue(mockConfig)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    fetchConfig.mockReturnValue(new Promise(() => {}))
    const { container } = render(<TeamBoard />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders team board with all agent names', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
    })
    // Names appear in both card and workload chart, use getAllByText
    expect(screen.getAllByText('Ripley').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Dallas').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Lambert').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Kane').length).toBeGreaterThanOrEqual(1)
  })

  it('shows agent roles', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Lead')).toBeInTheDocument()
    })
    expect(screen.getByText('Frontend Dev')).toBeInTheDocument()
    expect(screen.getByText('Backend Dev')).toBeInTheDocument()
    expect(screen.getByText('Tester')).toBeInTheDocument()
  })

  it('assigns tasks to correct agents from issue labels', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('#48')).toBeInTheDocument()
    })
    expect(screen.getByText('Add component tests')).toBeInTheDocument()
  })

  it('shows idle state for agents with no active tasks', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
    })
    const idleTexts = screen.getAllByText(/Idle • No active tasks/)
    expect(idleTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows active agent count in header', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText(/of 4 agents active/)).toBeInTheDocument()
    })
  })

  it('shows error state and falls back to mock workload data', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch team data/)).toBeInTheDocument()
    })
    expect(screen.getByText('Showing cached data')).toBeInTheDocument()
    expect(getAgentWorkload).toHaveBeenCalled()
  })

  it('shows error on HTTP error response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch team data/)).toBeInTheDocument()
    })
  })

  it('renders workload distribution chart', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Workload Distribution')).toBeInTheDocument()
    })
  })

  it('renders refresh button and reloads on click', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('Team Board')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Refresh'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('shows queue count for agents with multiple tasks', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<TeamBoard />)
    await waitFor(() => {
      expect(screen.getByText('+1')).toBeInTheDocument()
    })
    expect(screen.getByText('more in queue')).toBeInTheDocument()
  })
})