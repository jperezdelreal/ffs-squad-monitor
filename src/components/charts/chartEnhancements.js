/**
 * Chart enhancement utilities — zoom, anomaly detection, export
 */

/**
 * Detects anomalies in time-series data (>2 standard deviations from mean)
 * @param {Array<{timestamp: string, value: number}>} data - Time series data
 * @returns {Array<number>} Indices of anomalous points
 */
export function detectAnomalies(data) {
  if (data.length < 3) return []
  
  const values = data.map(d => d.value)
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  const anomalies = []
  values.forEach((value, index) => {
    if (Math.abs(value - mean) > 2 * stdDev) {
      anomalies.push(index)
    }
  })
  
  return anomalies
}

/**
 * Creates annotation config for anomalous points
 * @param {Array<number>} indices - Indices of anomalous points
 * @param {Array} labels - Chart labels
 * @param {Array} values - Data values
 * @returns {Object} Annotation configuration
 */
export function createAnomalyAnnotations(indices, labels, values) {
  const annotations = {}
  
  indices.forEach((index, i) => {
    annotations[`anomaly${i}`] = {
      type: 'point',
      xValue: labels[index],
      yValue: values[index],
      backgroundColor: 'rgba(244, 63, 94, 0.3)',
      borderColor: '#f43f5e',
      borderWidth: 2,
      radius: 10,
      drawTime: 'afterDatasetsDraw',
    }
  })
  
  return annotations
}

/**
 * Exports chart as PNG image
 * @param {ChartJS} chartRef - Chart.js instance reference
 * @param {string} filename - Output filename
 */
export function exportChartAsPNG(chartRef, filename = 'chart.png') {
  if (!chartRef) return
  
  const url = chartRef.toBase64Image()
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
}

/**
 * Exports chart data as CSV
 * @param {Array} data - Chart data array
 * @param {string} filename - Output filename
 */
export function exportChartAsCSV(data, filename = 'chart-data.csv') {
  if (!data || !data.length) return
  
  // Build CSV content
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row => 
    Object.values(row).map(val => 
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',')
  )
  
  const csv = [headers, ...rows].join('\n')
  
  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Zoom plugin configuration for Chart.js
 */
export const zoomConfig = {
  pan: {
    enabled: true,
    mode: 'x',
    modifierKey: 'shift',
  },
  zoom: {
    wheel: {
      enabled: true,
      speed: 0.05,
    },
    pinch: {
      enabled: true,
    },
    mode: 'x',
  },
  limits: {
    x: { min: 'original', max: 'original' },
    y: { min: 'original', max: 'original' },
  },
}

/**
 * Enhanced tooltip callbacks with comparative data
 */
export const enhancedTooltipCallbacks = {
  label: function(context) {
    let label = context.dataset.label || ''
    if (label) {
      label += ': '
    }
    if (context.parsed.y !== null) {
      label += context.parsed.y
    }
    
    // Add comparative data (% change from previous point)
    if (context.dataIndex > 0 && context.dataset.data[context.dataIndex - 1] !== undefined) {
      const prev = context.dataset.data[context.dataIndex - 1]
      const current = context.parsed.y
      if (prev > 0) {
        const change = ((current - prev) / prev * 100).toFixed(1)
        const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→'
        label += ` (${arrow} ${Math.abs(change)}%)`
      }
    }
    
    return label
  },
}
