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
    
    // Create gradient fill programmatically
    const createGradient = (ctx, chartArea) => {
      if (!chartArea) return color + '30'
      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
      gradient.addColorStop(0, color + 'CC')  // 80% opacity at top
      gradient.addColorStop(0.5, color + '66')  // 40% opacity at mid
      gradient.addColorStop(1, color + '0D')  // 5% opacity at bottom
      return gradient
    }

    return {
      label: s.label,
      data: s.data.map(d => d.value),
      borderColor: color,
      backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return color + '30'
        return createGradient(ctx, chartArea)
      },
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      borderWidth: 2.5,
      // Smooth animation on hover
      hoverBorderWidth: 3,
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
