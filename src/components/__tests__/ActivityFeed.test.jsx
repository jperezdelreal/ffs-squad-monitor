import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActivityFeed } from '../ActivityFeed'

vi.mock('../../services/config', () => ({
  getConfigSync: vi.fn(() => ({
    repos: [
      { name: 'ffs-squad-monitor', color: '#06b6d4' },
      { name: 'FirstFrameStudios', color: '#8b5cf6' },
    ],
  })),
}))

const mockEvents = [
  {
    id: '1',
    type: 'PushEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'dallas',
    createdAt: new Date().toISOString(),
    payload: { commits: [{ sha: 'abc' }, { sha: 'def' }] },
  },
  {
    id: '2',
    type: 'PullRequestEvent',
    repo: 'jperezdelreal/FirstFrameStudios',
    actor: 'ripley',
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    payload: { action: 'opened', number: 42 },
  },
  {
    id: '3',
    type: 'IssuesEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'lambert',
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
    payload: { action: 'closed', issue: { number: 10 } },
  },
  {
    id: '4',
    type: 'CreateEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'kane',
    createdAt: new Date(Date.now() - 30 * 1000).toISOString(),
    payload: { ref_type: 'branch' },
  },
  {
    id: '5',
    type: 'WatchEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'user1',
    createdAt: new Date().toISOString(),
    payload: {},
  },
  {
    id: '6',
    type: 'ForkEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'user2',
    createdAt: new Date().toISOString(),
    payload: {},
  },
  {
    id: '7',
    type: 'DeleteEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'user3',
    createdAt: new Date().toISOString(),
    payload: { ref_type: 'branch' },
  },
  {
    id: '8',
    type: 'ReleaseEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'user4',
    createdAt: new Date().toISOString(),
    payload: { action: 'published', release: { tag_name: 'v1.0.0' } },
  },
  {
    id: '9',
    type: 'UnknownEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'user5',
    createdAt: new Date().toISOString(),
    payload: {},
  },
]

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders events after successful fetch', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('dallas')).toBeInTheDocument()
    })
    expect(screen.getByText(/pushed 2 commits/)).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })
    expect(screen.getByText(/Unable to load activity feed/)).toBeInTheDocument()
  })

  it('shows error state on non-ok response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })
  })

  it('retries on error when Retry button is clicked', async () => {
    let callCount = 0
    global.fetch = vi.fn(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Try Again'))
    await waitFor(() => {
      expect(screen.getByText('dallas')).toBeInTheDocument()
    })
  })

  it('displays event descriptions for all event types', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText(/pushed 2 commits/)).toBeInTheDocument()
    })
    expect(screen.getByText(/opened pull request #42/)).toBeInTheDocument()
    expect(screen.getByText(/closed issue #10/)).toBeInTheDocument()
    expect(screen.getByText(/created branch/)).toBeInTheDocument()
    expect(screen.getByText(/starred the repository/)).toBeInTheDocument()
    expect(screen.getByText(/forked the repository/)).toBeInTheDocument()
    expect(screen.getByText(/deleted branch/)).toBeInTheDocument()
    expect(screen.getByText(/published release v1\.0\.0/)).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('shows empty state when no events match filters', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('No Activity Yet')).toBeInTheDocument()
    })
  })

  it('filters events by repository', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('dallas')).toBeInTheDocument()
    })

    const repoSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(repoSelect, { target: { value: 'jperezdelreal/FirstFrameStudios' } })

    expect(screen.getByText('ripley')).toBeInTheDocument()
    expect(screen.queryByText('dallas')).not.toBeInTheDocument()
  })

  it('filters events by type', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('dallas')).toBeInTheDocument()
    })

    const typeSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(typeSelect, { target: { value: 'PushEvent' } })

    expect(screen.getByText('dallas')).toBeInTheDocument()
    expect(screen.queryByText('ripley')).not.toBeInTheDocument()
  })

  it('renders refresh button and reloads on click', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText('dallas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Refresh'))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('formats singular commit correctly', async () => {
    const singleCommitEvent = [{
      id: '10',
      type: 'PushEvent',
      repo: 'jperezdelreal/ffs-squad-monitor',
      actor: 'test',
      createdAt: new Date().toISOString(),
      payload: { commits: [{ sha: 'abc' }] },
    }]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(singleCommitEvent),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText(/pushed 1 commit$/)).toBeInTheDocument()
    })
  })

  it('handles push events with no commits array', async () => {
    const noCommitEvent = [{
      id: '11',
      type: 'PushEvent',
      repo: 'jperezdelreal/ffs-squad-monitor',
      actor: 'test',
      createdAt: new Date().toISOString(),
      payload: {},
    }]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(noCommitEvent),
      })
    )

    render(<ActivityFeed />)
    await waitFor(() => {
      expect(screen.getByText(/pushed 0 commits/)).toBeInTheDocument()
    })
  })
})