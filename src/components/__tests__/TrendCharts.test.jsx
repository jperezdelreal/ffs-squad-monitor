import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStore } from '../../store/store'

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

const mockData = [
  { timestamp: '2026-03-10T00:00:00Z', channel: 'issues', data: { total: 10, open: 4, closed: 6 } },
]

describe('TrendCharts', () => {
  beforeEach(() => { 
    vi.restoreAllMocks()
    useStore.setState({
      metricsIssues: [],
      metricsAgents: [],
      metricsActions: [],
      metricsLoading: false,
      metricsError: null,
      metricsTimeRange: '7d',
      fetchAllMetrics: vi.fn(),
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('shows loading state initially', () => {
    useStore.setState({ metricsLoading: true })
    const { container } = render(<TrendCharts />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders charts after data loads', async () => {
    useStore.setState({
      metricsIssues: mockData,
      metricsAgents: [],
      metricsActions: [],
      metricsLoading: false,
    })
    render(<TrendCharts />)
    await waitFor(() => {
      expect(screen.getByText('Trend Analytics')).toBeInTheDocument()
    })
    expect(screen.getByText(/Issues Over Time/)).toBeInTheDocument()
    expect(screen.getByText(/Open vs Closed Issues/)).toBeInTheDocument()
    expect(screen.getByText(/Tasks by Agent/)).toBeInTheDocument()
  })

  it('shows error banner on fetch failure', async () => {
    useStore.setState({
      metricsError: 'Network error',
      metricsLoading: false,
    })
    render(<TrendCharts />)
    await waitFor(() => {
      expect(screen.getByText(/Metrics Error/)).toBeInTheDocument()
    })
  })

  it('renders time range buttons', async () => {
    render(<TrendCharts />)
    await waitFor(() => { expect(screen.getByText('7d')).toBeInTheDocument() })
    expect(screen.getByText('30d')).toBeInTheDocument()
    expect(screen.getByText('90d')).toBeInTheDocument()
  })

  it('refresh button triggers refetch', async () => {
    const mockFetch = vi.fn()
    useStore.setState({ fetchAllMetrics: mockFetch })
    render(<TrendCharts />)
    await waitFor(() => { expect(screen.getByText(/Refresh/)).toBeInTheDocument() })
    fireEvent.click(screen.getByText(/Refresh/))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
