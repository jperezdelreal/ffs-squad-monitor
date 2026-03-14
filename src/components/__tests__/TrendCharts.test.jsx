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

import { TrendCharts } from '../TrendCharts'

const mockResponse = (data = []) => ({
  ok: true,
  json: () => Promise.resolve({ channel: 'issues', data, count: data.length }),
})

describe('TrendCharts', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = render(<TrendCharts />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders charts after data loads', async () => {
    const data = [
      { timestamp: '2026-03-10T00:00:00Z', channel: 'issues', data: { total: 10, open: 4, closed: 6 } },
    ]
    global.fetch = vi.fn(() => Promise.resolve(mockResponse(data)))
    render(<TrendCharts />)
    await waitFor(() => {
      expect(screen.getByText('Trend Analytics')).toBeInTheDocument()
    })
    expect(screen.getByText(/Issues Over Time/)).toBeInTheDocument()
    expect(screen.getByText(/Open vs Closed Issues/)).toBeInTheDocument()
    expect(screen.getByText(/Tasks by Agent/)).toBeInTheDocument()
  })

  it('shows error banner on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<TrendCharts />)
    await waitFor(() => {
      expect(screen.getByText(/Some metrics failed to load/)).toBeInTheDocument()
    })
  })

  it('renders time range buttons', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockResponse([])))
    render(<TrendCharts />)
    await waitFor(() => { expect(screen.getByText('7d')).toBeInTheDocument() })
    expect(screen.getByText('30d')).toBeInTheDocument()
    expect(screen.getByText('90d')).toBeInTheDocument()
  })

  it('refresh button triggers refetch', async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockResponse([])))
    render(<TrendCharts />)
    await waitFor(() => { expect(screen.getByText(/Refresh/)).toBeInTheDocument() })
    fireEvent.click(screen.getByText(/Refresh/))
    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })
})
