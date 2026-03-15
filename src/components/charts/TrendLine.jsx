import React, { useRef, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import './chartConfig.js'
import { buildBaseOptions, CHART_COLORS } from './chartConfig.js'
import { detectAnomalies, createAnomalyAnnotations, exportChartAsPNG, exportChartAsCSV } from './chartEnhancements.js'
import { EmptyState, EmptyStateIllustrations } from '../EmptyState'

export function TrendLine({ 
  data = [], 
  label = 'Value', 
  color = CHART_COLORS.emerald, 
  timeRange = '7d',
  onDataPointClick = null,
  showAnomalies = false,
  chartTitle = 'chart',
}) {
  const chartRef = useRef(null)

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

  const anomalyIndices = useMemo(() => 
    showAnomalies ? detectAnomalies(data) : [], 
    [data, showAnomalies]
  )

  const chartData = {
    labels: data.map(d => d.timestamp),
    datasets: [
      {
        label,
        data: data.map(d => d.value),
        borderColor: color,
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return color + '20'
          
          // Create smooth gradient fill
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, color + 'AA')  // 67% opacity at top
          gradient.addColorStop(0.4, color + '66')  // 40% opacity at mid
          gradient.addColorStop(1, color + '0D')  // 5% opacity at bottom
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: (context) => {
          // Larger points for anomalies
          if (showAnomalies && anomalyIndices.includes(context.dataIndex)) {
            return 6
          }
          return data.length > 50 ? 0 : 4
        },
        pointBackgroundColor: (context) => {
          if (showAnomalies && anomalyIndices.includes(context.dataIndex)) {
            return CHART_COLORS.rose
          }
          return color
        },
        pointBorderColor: (context) => {
          if (showAnomalies && anomalyIndices.includes(context.dataIndex)) {
            return '#fff'
          }
          return '#fff'
        },
        pointHoverRadius: 7,
        pointBorderWidth: (context) => {
          if (showAnomalies && anomalyIndices.includes(context.dataIndex)) {
            return 2
          }
          return 0
        },
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
        borderWidth: 2.5,
        hoverBorderWidth: 3,
      },
    ],
  }

  const handleClick = (event, elements) => {
    if (elements.length > 0 && onDataPointClick) {
      const dataIndex = elements[0].index
      const dataPoint = data[dataIndex]
      onDataPointClick(dataPoint, dataIndex)
    }
  }

  const annotations = useMemo(() => {
    if (!showAnomalies || !anomalyIndices.length) return {}
    const values = data.map(d => d.value)
    return createAnomalyAnnotations(anomalyIndices, chartData.labels, values)
  }, [showAnomalies, anomalyIndices, data])

  const options = buildBaseOptions({
    xScale: {
      type: 'time',
      time: { unit: timeRangeToUnit(timeRange) },
    },
    onClick: handleClick,
    annotations,
  })

  // Force chart rebuild on theme change
  const chartKey = `${theme}-${data.length}`

  const handleExportPNG = () => {
    if (chartRef.current) {
      exportChartAsPNG(chartRef.current, `${chartTitle}-${timeRange}.png`)
    }
  }

  const handleExportCSV = () => {
    exportChartAsCSV(data, `${chartTitle}-${timeRange}.csv`)
  }

  return (
    <div className="relative h-full">
      <Line key={chartKey} ref={chartRef} data={chartData} options={options} />
      <div className="absolute top-0 right-0 flex gap-2 opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={handleExportPNG}
          className="px-2 py-1 text-xs bg-white/5 dark:bg-white/5 light:bg-black/5 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 rounded border border-white/10 dark:border-white/10 light:border-black/10"
          title="Export as PNG"
        >
          📷
        </button>
        <button
          onClick={handleExportCSV}
          className="px-2 py-1 text-xs bg-white/5 dark:bg-white/5 light:bg-black/5 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 rounded border border-white/10 dark:border-white/10 light:border-black/10"
          title="Export as CSV"
        >
          📊
        </button>
      </div>
    </div>
  )
}

function timeRangeToUnit(range) {
  switch (range) {
    case '7d': return 'day'
    case '30d': return 'day'
    case '90d': return 'week'
    default: return 'day'
  }
}
