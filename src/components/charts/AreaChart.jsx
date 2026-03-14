import React from 'react'
import { Line } from 'react-chartjs-2'
import './chartConfig.js'
import { buildBaseOptions, COLOR_LIST } from './chartConfig.js'
import { EmptyState, EmptyStateIllustrations } from '../EmptyState'

export function AreaChart({ series = [], timeRange = '30d' }) {
  const hasSomeData = series.some(s => s.data?.length > 0)
  if (!series.length || !hasSomeData) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="areachart-empty">
        <EmptyState
          icon={<EmptyStateIllustrations.NotEnoughData />}
          title="No data available"
          message="Historical data will appear here once collected"
          className="border-0 p-4"
        />
      </div>
    )
  }

  const longest = series.reduce((a, b) => (a.data?.length > b.data?.length ? a : b), series[0])
  const labels = longest.data.map(d => d.timestamp)

  const datasets = series.map((s, i) => {
    const color = s.color || COLOR_LIST[i % COLOR_LIST.length]
    return {
      label: s.label,
      data: s.data.map(d => d.value),
      borderColor: color,
      backgroundColor: color + '30',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
    }
  })

  const chartData = { labels, datasets }

  const options = buildBaseOptions({
    showLegend: true,
    xScale: {
      type: 'time',
      time: { unit: timeRange === '90d' ? 'week' : 'day' },
      stacked: true,
    },
    yScale: { stacked: true },
  })

  return <Line data={chartData} options={options} />
}
