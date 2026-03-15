/**
 * Shared Chart.js configuration — theme-adaptive colors and animations.
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

function getTheme() {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

function getThemedColors() {
  const theme = getTheme()
  return {
    text: theme === 'light' ? '#0d1117' : '#f0f6fc',
    textMuted: theme === 'light' ? '#57606a' : '#8b949e',
    grid: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
    tooltipBg: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(13, 17, 23, 0.95)',
    tooltipBorder: theme === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)',
    tooltipTitle: theme === 'light' ? '#0d1117' : '#f0f6fc',
    tooltipBody: theme === 'light' ? '#57606a' : '#8b949e',
  }
}

const buildGlassmorphismTooltip = () => {
  const colors = getThemedColors()
  return {
    backgroundColor: colors.tooltipBg,
    titleColor: colors.tooltipTitle,
    bodyColor: colors.tooltipBody,
    borderColor: colors.tooltipBorder,
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
    callbacks: {
      labelTextColor: () => colors.tooltipBody,
    },
  }
}

export function buildBaseOptions(overrides = {}) {
  const colors = getThemedColors()
  
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
        from: (ctx) => ctx.chart.scales.x?.getPixelForValue(0) || 0,
      },
      y: {
        type: 'number',
        easing: 'easeOutElastic',
        duration: 1200,
        from: (ctx) => ctx.chart.scales.y?.getPixelForValue(0) || 0,
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
        ...buildGlassmorphismTooltip(),
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
          color: colors.textMuted,
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
        onClick: (event, legendItem, legend) => {
          const index = legendItem.datasetIndex
          const chart = legend.chart
          const meta = chart.getDatasetMeta(index)
          
          // Toggle visibility
          meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null
          chart.update()
        },
      },
      zoom: overrides.enableZoom !== false ? {
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
      } : undefined,
      annotation: {
        annotations: overrides.annotations || {},
      },
    },
    scales: {
      x: {
        grid: { 
          color: colors.grid,
          drawBorder: false,
          lineWidth: 1,
        },
        ticks: { 
          color: colors.textMuted,
          font: { size: 10, family: 'ui-monospace, monospace' },
          padding: 8,
        },
        border: { display: false },
        ...overrides.xScale,
      },
      y: {
        grid: { 
          color: colors.grid,
          drawBorder: false,
          lineWidth: 1,
        },
        ticks: { 
          color: colors.textMuted,
          font: { size: 10, family: 'ui-monospace, monospace' },
          padding: 8,
        },
        border: { display: false },
        beginAtZero: true,
        ...overrides.yScale,
      },
    },
    onClick: overrides.onClick,
    ...overrides.root,
  }
}
