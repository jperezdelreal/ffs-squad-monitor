import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const HEALTHY_RESPONSE = {
  status: 'healthy',
  timestamp: '2026-03-15T12:00:00Z',
  dependencies: {
    github: {
      reachable: true,
      authenticated: true,
      rateLimit: { remaining: 4500, limit: 5000, resetsAt: null, healthy: true },
    },
    heartbeat: {
      fileAccessible: true,
      status: 'idle',
      lastTimestamp: '2026-03-15T11:59:00Z',
      healthy: true,
    },
  },
}

const DEGRADED_RESPONSE = {
  status: 'degraded',
  timestamp: '2026-03-15T12:00:00Z',
  dependencies: {
    github: {
      reachable: true,
      authenticated: false,
      rateLimit: { remaining: 10, limit: 60, resetsAt: null, healthy: false },
    },
    heartbeat: {
      fileAccessible: true,
      status: 'running',
      lastTimestamp: '2026-03-15T11:59:00Z',
      healthy: true,
    },
  },
}

const UNHEALTHY_RESPONSE = {
  status: 'unhealthy',
  timestamp: '2026-03-15T12:00:00Z',
  dependencies: {
    github: {
      reachable: false,
      authenticated: false,
      rateLimit: { remaining: 0, limit: 60, resetsAt: null, healthy: false },
    },
    heartbeat: {
      fileAccessible: false,
      status: 'offline',
      lastTimestamp: null,
      healthy: false,
    },
  },
}

// Mock the api module to control fetchHealth behavior
vi.mock('../../lib/api', () => ({
  fetchHealth: vi.fn(),
}))

import { fetchHealth } from '../../lib/api'
import { DependencyHealth } from '../DependencyHealth'

describe('DependencyHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
    fetchHealth.mockResolvedValue(HEALTHY_RESPONSE)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    fetchHealth.mockImplementation(() => new Promise(() => {}))
    render(<DependencyHealth />)
    expect(screen.getByText('Checking…')).toBeTruthy()
  })

  it('renders healthy status after data loads', async () => {
    render(<DependencyHealth />)
    await waitFor(() => {
      expect(screen.getByText('Deps')).toBeTruthy()
    })
    expect(screen.getByLabelText('Dependencies: Healthy')).toBeTruthy()
  })

  it('renders degraded status', async () => {
    fetchHealth.mockResolvedValue(DEGRADED_RESPONSE)
    render(<DependencyHealth />)
    await waitFor(() => {
      expect(screen.getByLabelText('Dependencies: Degraded')).toBeTruthy()
    })
  })

  it('renders unhealthy status', async () => {
    fetchHealth.mockResolvedValue(UNHEALTHY_RESPONSE)
    render(<DependencyHealth />)
    await waitFor(() => {
      expect(screen.getByLabelText('Dependencies: Unhealthy')).toBeTruthy()
    })
  })

  it('shows dependency panel on click', async () => {
    render(<DependencyHealth />)
    await waitFor(() => {
      expect(screen.getByText('Deps')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('Dependency Status')).toBeTruthy()
    expect(screen.getByText('GitHub API')).toBeTruthy()
    expect(screen.getByText('Rate Limit')).toBeTruthy()
    expect(screen.getByText('Heartbeat File')).toBeTruthy()
  })

  it('displays rate limit numbers', async () => {
    render(<DependencyHealth />)
    await waitFor(() => expect(screen.getByText('Deps')).toBeTruthy())

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('4500/5000')).toBeTruthy()
    expect(screen.getByText('Authenticated')).toBeTruthy()
  })

  it('shows Anonymous for unauthenticated', async () => {
    fetchHealth.mockResolvedValue(DEGRADED_RESPONSE)
    render(<DependencyHealth />)
    await waitFor(() => expect(screen.getByText('Deps')).toBeTruthy())

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('Anonymous')).toBeTruthy()
  })

  it('shows overall status in panel', async () => {
    render(<DependencyHealth />)
    await waitFor(() => expect(screen.getByText('Deps')).toBeTruthy())

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('Overall')).toBeTruthy()
    expect(screen.getByText('Healthy')).toBeTruthy()
  })

  it('stays in loading state on fetch error', async () => {
    fetchHealth.mockResolvedValue({ error: true, message: 'failed' })
    render(<DependencyHealth />)
    // Should stay in loading/checking state when error occurs
    await waitFor(() => {
      expect(screen.getByText('Checking…')).toBeTruthy()
    })
  })

  it('has refresh button in panel', async () => {
    render(<DependencyHealth />)
    await waitFor(() => expect(screen.getByText('Deps')).toBeTruthy())

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByLabelText('Refresh health')).toBeTruthy()
  })
})
