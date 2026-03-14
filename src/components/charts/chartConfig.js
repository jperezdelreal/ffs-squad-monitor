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
  backgroundColor: 'rgba(15, 19, 26, 0.95)',
  titleColor: '#f3f4f6',
  bodyColor: '#d1d5db',
  borderColor: 'rgba(255, 255, 255, 0.15)',
  borderWidth: 1.5,
  cornerRadius: 12,
  padding: 14,
  boxPadding: 6,
  usePointStyle: true,
  titleFont: {
    size: 12,
    weight: 'bold',
    family: 'Inter, system-ui, sans-serif',
  },
  bodyFont: {
    size: 11,
    family: 'ui-monospace, monospace',
  },
  caretSize: 8,
  caretPadding: 10,
  displayColors: true,
  boxWidth: 12,
  boxHeight: 12,
  // Glass backdrop effect
  callbacks: {
    labelTextColor: () => '#d1d5db',
  },
}

export function buildBaseOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: 'easeInOutQuart',
      delay: (context) => {
        // Stagger animation for each data point
        const delay = context.dataIndex * 30
        return delay > 300 ? 300 : delay
      },
      // Smooth draw-in effect
      x: {
        type: 'number',
        easing: 'easeInOutQuart',
        duration: 800,
        from: (ctx) => ctx.chart.scales.x.getPixelForValue(0),
      },
      y: {
        type: 'number',
        easing: 'easeOutElastic',
        duration: 1200,
        from: (ctx) => ctx.chart.scales.y.getPixelForValue(0),
      },
    },
    // Smooth data transition animations
    transitions: {
      active: {
        animation: {
          duration: 400,
        },
      },
      resize: {
        animation: {
          duration: 400,
          easing: 'easeInOutQuart',
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      tooltip: { 
        ...glassmorphismTooltip,
        animation: {
          duration: 250,
        },
        displayColors: true,
        boxWidth: 12,
        boxHeight: 12,
        boxPadding: 6,
      },
      legend: {
        display: overrides.showLegend ?? false,
        position: 'top',
        labels: {
          color: '#9ca3af',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, family: 'Inter, system-ui, sans-serif' },
        },
        onHover: (event) => {
          event.native.target.style.cursor = 'pointer'
        },
        onLeave: (event) => {
          event.native.target.style.cursor = 'default'
        },
      },
    },
    scales: {
      x: {
        grid: { 
          color: 'rgba(255,255,255,0.05)', 
          drawBorder: false,
          lineWidth: 1,
        },
        ticks: { 
          color: '#6b7280', 
          font: { size: 10, family: 'ui-monospace, monospace' },
          padding: 8,
        },
        border: { display: false },
        ...overrides.xScale,
      },
      y: {
        grid: { 
          color: 'rgba(255,255,255,0.05)', 
          drawBorder: false,
          lineWidth: 1,
        },
        ticks: { 
          color: '#6b7280', 
          font: { size: 10, family: 'ui-monospace, monospace' },
          padding: 8,
        },
        border: { display: false },
        beginAtZero: true,
        ...overrides.yScale,
      },
    },
    ...overrides.root,
  }
}
