import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CostTracker } from '../CostTracker'

vi.mock('../../services/mockData', () => ({
  getCostHistory: vi.fn(() => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push({
        date: date.toISOString().split('T')[0],
        actual: 0,
        budget: 500 / 30,
      })
    }
    return days
  }),
  getCIMinutesUsage: vi.fn(() => ({
    used: 420,
    total: 2000,
    percentage: 21,
  })),
}))

import { getCIMinutesUsage } from '../../services/mockData'

describe('CostTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    const { container } = render(<CostTracker />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the hero card with current spend after loading', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('CURRENT MONTHLY SPEND')).toBeInTheDocument()
    })
  })

  it('displays Azure savings', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('vs. Azure ACI')).toBeInTheDocument()
    })
    expect(screen.getByText(/€120/)).toBeInTheDocument()
  })

  it('displays AWS savings', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('vs. AWS Lambda')).toBeInTheDocument()
    })
    expect(screen.getByText(/€200/)).toBeInTheDocument()
  })

  it('displays total savings badge', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText(/€320\/mo Total Savings/)).toBeInTheDocument()
    })
  })

  it('renders budget chart section', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Budget vs Actual (Last 30 Days)')).toBeInTheDocument()
    })
  })

  it('renders resource usage section with CI minutes', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Resource Usage')).toBeInTheDocument()
    })
    expect(screen.getByText('GitHub Actions Minutes')).toBeInTheDocument()
    expect(screen.getByText('420 / 2000 min')).toBeInTheDocument()
  })

  it('shows CI usage percentage and remaining', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText(/21% used/)).toBeInTheDocument()
    })
    expect(screen.getByText(/1580 minutes remaining/)).toBeInTheDocument()
  })

  it('renders resource cards for storage, bandwidth, compute', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Storage')).toBeInTheDocument()
    })
    expect(screen.getByText('Bandwidth')).toBeInTheDocument()
    expect(screen.getByText('Compute')).toBeInTheDocument()
  })

  it('renders success banner', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('100% Cost Optimization')).toBeInTheDocument()
    })
    expect(screen.getByText('Free Hosting')).toBeInTheDocument()
    expect(screen.getByText('Free CI/CD')).toBeInTheDocument()
    expect(screen.getByText('Free Storage')).toBeInTheDocument()
  })

  it('does not show approaching-limit warning when usage is low', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Resource Usage')).toBeInTheDocument()
    })
    expect(screen.queryByText('Approaching Free Tier Limit')).not.toBeInTheDocument()
  })

  it('shows approaching-limit warning when usage exceeds 80%', async () => {
    getCIMinutesUsage.mockReturnValue({
      used: 1700,
      total: 2000,
      percentage: 85,
    })

    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText('Approaching Free Tier Limit')).toBeInTheDocument()
    })
    expect(screen.getByText(/85% of your GitHub Actions minutes/)).toBeInTheDocument()
  })

  it('shows the free tier message', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText(/100% Free Tier/)).toBeInTheDocument()
    })
  })

  it('renders budget chart legend', async () => {
    render(<CostTracker />)
    await waitFor(() => {
      expect(screen.getByText(/Budget \(€500\/mo\)/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Actual \(€0\)/)).toBeInTheDocument()
  })
})