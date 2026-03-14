import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

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

import { TrendLine } from '../TrendLine'
import { BarChart } from '../BarChart'
import { AreaChart } from '../AreaChart'

describe('TrendLine', () => {
  it('renders empty state when no data', () => {
    render(<TrendLine data={[]} />)
    expect(screen.getByTestId('trendline-empty')).toHaveTextContent('No data available')
  })

  it('renders chart with data', () => {
    const data = [
      { timestamp: '2026-03-10T00:00:00Z', value: 10 },
      { timestamp: '2026-03-11T00:00:00Z', value: 15 },
    ]
    render(<TrendLine data={data} label="Issues Closed" color="#10b981" />)
    expect(screen.getByTestId('mock-line-chart')).toHaveAttribute('data-label', 'Issues Closed')
  })

  it('defaults label to Value', () => {
    render(<TrendLine data={[{ timestamp: '2026-03-10T00:00:00Z', value: 5 }]} />)
    expect(screen.getByTestId('mock-line-chart')).toHaveAttribute('data-label', 'Value')
  })
})

describe('BarChart', () => {
  it('renders empty state when no data', () => {
    render(<BarChart data={[]} />)
    expect(screen.getByTestId('barchart-empty')).toHaveTextContent('No data available')
  })

  it('renders chart with data', () => {
    render(<BarChart data={[{ label: 'Dallas', value: 10 }]} title="Issues by Agent" />)
    expect(screen.getByTestId('mock-bar-chart')).toHaveAttribute('data-label', 'Issues by Agent')
  })
})

describe('AreaChart', () => {
  it('renders empty state when no series', () => {
    render(<AreaChart series={[]} />)
    expect(screen.getByTestId('areachart-empty')).toHaveTextContent('No data available')
  })

  it('renders empty state when all series empty', () => {
    render(<AreaChart series={[{ label: 'Open', data: [], color: '#f59e0b' }]} />)
    expect(screen.getByTestId('areachart-empty')).toHaveTextContent('No data available')
  })

  it('renders chart with series data', () => {
    const series = [
      { label: 'Open', data: [{ timestamp: '2026-03-10T00:00:00Z', value: 5 }], color: '#f59e0b' },
      { label: 'Closed', data: [{ timestamp: '2026-03-10T00:00:00Z', value: 10 }], color: '#10b981' },
    ]
    render(<AreaChart series={series} timeRange="30d" />)
    expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument()
  })
})
