import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react-chartjs-2', () => ({
  Line: (props) => <div data-testid="mock-line-chart" data-label={props.data?.datasets?.[0]?.label} />,
  Bar: (props) => <div data-testid="mock-bar-chart" data-label={props.data?.datasets?.[0]?.label} />,
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: 'CategoryScale', LinearScale: 'LinearScale', TimeScale: 'TimeScale',
  PointElement: 'PointElement', LineElement: 'LineElement', BarElement: 'BarElement',
  Filler: 'Filler', Tooltip: 'Tooltip', Legend: 'Legend',
}))
vi.mock('chartjs-adapter-date-fns', () => ({}))

import { Analytics } from '../Analytics'

const mockMetricsResponse = (data = []) => ({
  ok: true,
  json: () => Promise.resolve({ channel: 'issues', data, count: data.length }),
})

const sampleIssuesData = [
  { timestamp: '2026-03-10T00:00:00Z', channel: 'issues', data: { total: 10, open: 4, closed: 6, opened: 3 } },
  { timestamp: '2026-03-11T00:00:00Z', channel: 'issues', data: { total: 12, open: 3, closed: 9, opened: 5 } },
]

const sampleAgentsData = [
  { timestamp: '2026-03-11T00:00:00Z', channel: 'agents', data: [
    { name: 'Dallas', closedCount: 5 },
    { name: 'Ripley', closedCount: 8 },
    { name: 'Lambert', closedCount: 3 },
  ]},
]

describe('Analytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    try { localStorage.removeItem('ffs-analytics-time-range') } catch {}
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<Analytics />)
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()
  })

  it('renders analytics view after data loads', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse(sampleIssuesData)))
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByTestId('analytics-view')).toBeInTheDocument()
    })
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText(/Sprint Velocity/)).toBeInTheDocument()
    expect(screen.getByText(/Issue Lifecycle/)).toBeInTheDocument()
  })

  it('renders time range selector buttons', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse([])))
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    })
    expect(screen.getByText('Last 14 days')).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('persists time range to localStorage', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse([])))
    render(<Analytics />)
    await waitFor(() => { expect(screen.getByText('Last 7 days')).toBeInTheDocument() })
    fireEvent.click(screen.getByText('Last 30 days'))
    expect(localStorage.getItem('ffs-analytics-time-range')).toBe('30d')
  })

  it('renders KPI cards', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse(sampleIssuesData)))
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByText('Sprint Throughput')).toBeInTheDocument()
    })
    expect(screen.getByText('Avg Close Time')).toBeInTheDocument()
    expect(screen.getByText('Top Contributor')).toBeInTheDocument()
    expect(screen.getByText('Projected Usage')).toBeInTheDocument()
  })

  it('shows error banner on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByText(/Analytics Error/)).toBeInTheDocument()
    })
  })

  it('renders agent leaderboard with data', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('channel=agents')) {
        return Promise.resolve(mockMetricsResponse(sampleAgentsData))
      }
      return Promise.resolve(mockMetricsResponse(sampleIssuesData))
    })
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByTestId('agent-leaderboard')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Ripley').length).toBeGreaterThan(0)
  })

  it('shows empty leaderboard when no agent data', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse([])))
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument()
    })
  })

  it('renders resource usage trends section', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse(sampleIssuesData)))
    render(<Analytics />)
    await waitFor(() => {
      expect(screen.getByText(/Resource Usage Trends/)).toBeInTheDocument()
    })
  })

  it('refresh button triggers refetch', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockMetricsResponse([])))
    render(<Analytics />)
    await waitFor(() => { expect(screen.getByText(/Refresh/)).toBeInTheDocument() })
    fireEvent.click(screen.getByText(/Refresh/))
    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })
})
