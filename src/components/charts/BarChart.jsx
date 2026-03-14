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
        backgroundColor: colors.map(c => c + '80'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: colors.map(c => c + 'cc'),
      },
    ],
  }

  const options = buildBaseOptions({
    xScale: { type: 'category' },
  })

  return <Bar data={chartData} options={options} />
}
