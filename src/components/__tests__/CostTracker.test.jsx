import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CostTracker } from '../CostTracker'

const mockUsage = {
  totalMinutesUsed: 420,
  includedMinutes: 2000,
  percentage: 21,
  source: 'billing',
  totalRuns: 45,
  repos: [
    { repo: 'ffs-squad-monitor', label: 'Monitor', emoji: '📊', durationMinutes: 200, runs: 20 },
    { repo: 'FirstFrameStudios', label: 'Hub', emoji: '🎬', durationMinutes: 220, runs: 25 },
  ],
}

describe('CostTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = render(<CostTracker />)
    expect(container.querySelector('[class*="animate-shimmer"]')).toBeInTheDocument()
  })

  it('renders usage data after successful fetch', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('GITHUB ACTIONS USAGE')).toBeInTheDocument()
    })
    expect(screen.getByText('420')).toBeInTheDocument()
    expect(screen.getByText(/\/ 2000/)).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Cost data not available')).toBeInTheDocument()
    })
  })

  it('shows error on non-ok response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Cost data not available')).toBeInTheDocument()
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
        json: () => Promise.resolve(mockUsage),
      })
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Cost data not available')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))
    await waitFor(() => {
      expect(screen.getByText('GITHUB ACTIONS USAGE')).toBeInTheDocument()
    })
  })

  it('shows percentage and remaining minutes', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText(/21% used/)).toBeInTheDocument()
    })
    expect(screen.getByText(/1580 minutes remaining/)).toBeInTheDocument()
  })

  it('renders resource cards for storage, bandwidth, compute', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Storage')).toBeInTheDocument()
    })
    expect(screen.getByText('Bandwidth')).toBeInTheDocument()
    expect(screen.getByText('Compute')).toBeInTheDocument()
  })

  it('shows success banner when usage is below 80%', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Running on GitHub Free Tier')).toBeInTheDocument()
    })
    expect(screen.getByText('Free Hosting')).toBeInTheDocument()
    expect(screen.getByText('Free CI/CD')).toBeInTheDocument()
    expect(screen.getByText('Free Storage')).toBeInTheDocument()
  })

  it('does not show approaching-limit warning when usage is low', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Resource Usage')).toBeInTheDocument()
    })
    expect(screen.queryByText('Approaching Free Tier Limit')).not.toBeInTheDocument()
  })

  it('shows approaching-limit warning when usage exceeds 80%', async () => {
    const highUsage = {
      ...mockUsage,
      totalMinutesUsed: 1700,
      percentage: 85,
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(highUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Approaching Free Tier Limit')).toBeInTheDocument()
    })
    expect(screen.getByText(/85% of your GitHub Actions minutes/)).toBeInTheDocument()
  })

  it('renders per-repo breakdown', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Usage by Repository')).toBeInTheDocument()
    })
    expect(screen.getByText('Monitor')).toBeInTheDocument()
    expect(screen.getByText('Hub')).toBeInTheDocument()
  })

  it('shows data source info', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsage),
      })
    )

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText(/GitHub Billing API/)).toBeInTheDocument()
    })
  })
})