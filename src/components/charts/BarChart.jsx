import React from 'react'
import { Bar } from 'react-chartjs-2'
import './chartConfig.js'
import { buildBaseOptions, COLOR_LIST } from './chartConfig.js'
import { EmptyState, EmptyStateIllustrations } from '../EmptyState'

export function BarChart({ data = [], title = '' }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="barchart-empty">
        <EmptyState
          icon={<EmptyStateIllustrations.NotEnoughData />}
          title="No data available"
          message="Data will appear here once collected"
          className="border-0 p-4"
        />
      </div>
    )
  }

  const colors = data.map((_, i) => COLOR_LIST[i % COLOR_LIST.length])

  const chartData = {
    labels: data.map(d => d.label),
    datasets: [
      {
        label: title,
        data: data.map(d => d.value),
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return colors.map(c => c + '80')
          
          // Create gradient for each bar
          const dataIndex = context.dataIndex
          const color = colors[dataIndex % colors.length]
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, color + '40')  // 25% opacity at bottom
          gradient.addColorStop(1, color + 'CC')  // 80% opacity at top
          return gradient
        },
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        hoverBackgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return colors.map(c => c + 'ff')
          
          const dataIndex = context.dataIndex
          const color = colors[dataIndex % colors.length]
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, color + '99')  // 60% opacity at bottom
          gradient.addColorStop(1, color + 'FF')  // 100% opacity at top
          return gradient
        },
        hoverBorderWidth: 3,
      },
    ],
  }

  const options = buildBaseOptions({
    xScale: { type: 'category' },
  })

  return <Bar data={chartData} options={options} />
}
