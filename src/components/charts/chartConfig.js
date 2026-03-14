/**
 * Shared Chart.js configuration — dark theme matching glassmorphism design.
 * Registers only the Chart.js components we need for tree-shaking.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
)

export const CHART_COLORS = {
  emerald: '#10b981',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  purple: '#a855f7',
  rose: '#f43f5e',
}

export const COLOR_LIST = [
  CHART_COLORS.emerald,
  CHART_COLORS.cyan,
  CHART_COLORS.amber,
  CHART_COLORS.purple,
  CHART_COLORS.rose,
]

const glassmorphismTooltip = {
  backgroundColor: 'rgba(21, 25, 32, 0.85)',
  titleColor: '#e4e7eb',
  bodyColor: '#9ca3af',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  borderWidth: 1,
  cornerRadius: 8,
  padding: 12,
  boxPadding: 4,
  usePointStyle: true,
}

export function buildBaseOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: 'easeOutQuart',
    },
    plugins: {
      tooltip: { ...glassmorphismTooltip },
      legend: {
        display: overrides.showLegend ?? false,
        position: 'top',
        labels: {
          color: '#9ca3af',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11 },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#6b7280', font: { size: 10 } },
        border: { display: false },
        ...overrides.xScale,
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#6b7280', font: { size: 10 } },
        border: { display: false },
        beginAtZero: true,
        ...overrides.yScale,
      },
    },
    ...overrides.root,
  }
}
