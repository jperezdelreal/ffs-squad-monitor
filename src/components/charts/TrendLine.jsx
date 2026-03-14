import React from 'react'
import { Line } from 'react-chartjs-2'
import './chartConfig.js'
import { buildBaseOptions, CHART_COLORS } from './chartConfig.js'
import { EmptyState, EmptyStateIllustrations } from '../EmptyState'

export function TrendLine({ data = [], label = 'Value', color = CHART_COLORS.emerald, timeRange = '7d' }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="trendline-empty">
        <EmptyState
          icon={<EmptyStateIllustrations.NotEnoughData />}
          title="Not enough data for trends"
          message="Check back after a few rounds to see historical patterns"
          className="border-0 p-4"
        />
      </div>
    )
  }

  const chartData = {
    labels: data.map(d => d.timestamp),
    datasets: [
      {
        label,
        data: data.map(d => d.value),
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0.35,
        pointRadius: data.length > 50 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        borderWidth: 2,
      },
    ],
  }

  const options = buildBaseOptions({
    xScale: {
      type: 'time',
      time: { unit: timeRangeToUnit(timeRange) },
    },
  })

  return <Line data={chartData} options={options} />
}

function timeRangeToUnit(range) {
  switch (range) {
    case '7d': return 'day'
    case '30d': return 'day'
    case '90d': return 'week'
    default: return 'day'
  }
}
