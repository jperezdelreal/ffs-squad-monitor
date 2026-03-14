import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useStore } from '../../store/store'
import { DependencyHealth } from '../DependencyHealth'

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

function setHealthState(health, overrides = {}) {
  useStore.setState({
    health,
    healthLoading: false,
    healthError: null,
    fetchHealthData: vi.fn(),
    ...overrides,
  })
}

describe('DependencyHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    useStore.setState({ healthLoading: true, health: null, fetchHealthData: vi.fn() })
    render(<DependencyHealth />)
    expect(screen.getByText('Checking…')).toBeTruthy()
  })

  it('renders healthy status after data loads', () => {
    setHealthState(HEALTHY_RESPONSE)
    render(<DependencyHealth />)
    expect(screen.getByText('Deps')).toBeTruthy()
    expect(screen.getByLabelText('Dependencies: Healthy')).toBeTruthy()
  })

  it('renders degraded status', () => {
    setHealthState(DEGRADED_RESPONSE)
    render(<DependencyHealth />)
    expect(screen.getByLabelText('Dependencies: Degraded')).toBeTruthy()
  })

  it('renders unhealthy status', () => {
    setHealthState(UNHEALTHY_RESPONSE)
    render(<DependencyHealth />)
    expect(screen.getByLabelText('Dependencies: Unhealthy')).toBeTruthy()
  })

  it('shows dependency panel on click', async () => {
    setHealthState(HEALTHY_RESPONSE)
    render(<DependencyHealth />)

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('Dependency Status')).toBeTruthy()
    expect(screen.getByText('GitHub API')).toBeTruthy()
    expect(screen.getByText('Rate Limit')).toBeTruthy()
    expect(screen.getByText('Heartbeat File')).toBeTruthy()
  })

  it('displays rate limit numbers', async () => {
    setHealthState(HEALTHY_RESPONSE)
    render(<DependencyHealth />)

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('4500/5000')).toBeTruthy()
    expect(screen.getByText('Authenticated')).toBeTruthy()
  })

  it('shows Anonymous for unauthenticated', async () => {
    setHealthState(DEGRADED_RESPONSE)
    render(<DependencyHealth />)

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('Anonymous')).toBeTruthy()
  })

  it('shows overall status in panel', async () => {
    setHealthState(HEALTHY_RESPONSE)
    render(<DependencyHealth />)

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByText('Overall')).toBeTruthy()
    expect(screen.getByText('Healthy')).toBeTruthy()
  })

  it('stays in loading state on fetch error', () => {
    useStore.setState({
      health: null,
      healthLoading: false,
      healthError: 'Health check failed',
      fetchHealthData: vi.fn(),
    })
    render(<DependencyHealth />)
    expect(screen.getByText('Checking…')).toBeTruthy()
  })

  it('has refresh button in panel', async () => {
    setHealthState(HEALTHY_RESPONSE)
    render(<DependencyHealth />)

    await act(async () => {
      fireEvent.click(screen.getByText('Deps'))
    })

    expect(screen.getByLabelText('Refresh health')).toBeTruthy()
  })
})
