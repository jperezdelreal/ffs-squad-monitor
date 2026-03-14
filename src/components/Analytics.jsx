import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { TrendLine, BarChart, AreaChart } from './charts'
import { useStore } from '../store/store'
import { CHART_COLORS } from './charts/chartConfig'
import { ExportButton } from './ExportButton'

const TIME_RANGES = [
  { id: '7d', label: 'Last 7 days' },
  { id: '14d', label: 'Last 14 days' },
  { id: '30d', label: 'Last 30 days' },
]

const STORAGE_KEY = 'ffs-analytics-time-range'

function getInitialTimeRange() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && TIME_RANGES.some(r => r.id === saved)) return saved
  } catch { /* localStorage unavailable */ }
  return '14d'
}

export function Analytics() {
  const [timeRange, setTimeRange] = useState(getInitialTimeRange)

  const metricsIssues = useStore((state) => state.metricsIssues)
  const metricsAgents = useStore((state) => state.metricsAgents)
  const metricsActions = useStore((state) => state.metricsActions)
  const metricsLoading = useStore((state) => state.metricsLoading)
  const metricsError = useStore((state) => state.metricsError)
  const issues = useStore((state) => state.issues)
  const fetchAllMetrics = useStore((state) => state.fetchAllMetrics)

  useEffect(() => {
    fetchAllMetrics(timeRange)
  }, [timeRange])

  const handleTimeRangeChange = useCallback((range) => {
    setTimeRange(range)
    try { localStorage.setItem(STORAGE_KEY, range) } catch { /* noop */ }
  }, [])

  const issuesData = metricsIssues
  const agentsData = metricsAgents
  const actionsData = metricsActions
  const loading = metricsLoading
  const hasError = !!metricsError

  // Sprint velocity: issues opened vs closed per day
  const velocityData = useMemo(() => {
    if (!issuesData.length) return { opened: [], closed: [], series: [] }
    const openedSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.opened ?? snap.data?.open ?? 0,
    }))
    const closedSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.closed ?? 0,
    }))
    return {
      opened: openedSeries,
      closed: closedSeries,
      series: [
        { label: 'Opened', data: openedSeries, color: CHART_COLORS.amber },
        { label: 'Closed', data: closedSeries, color: CHART_COLORS.emerald },
      ],
    }
  }, [issuesData])

  // Sprint throughput: total closed in range
  const sprintThroughput = useMemo(() => {
    return velocityData.closed.reduce((sum, d) => sum + d.value, 0)
  }, [velocityData.closed])

  // Issue lifecycle: stacked area chart by state
  const lifecycleSeries = useMemo(() => {
    const openSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.open ?? 0,
    }))
    const inProgressSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.inProgress ?? snap.data?.in_progress ?? 0,
    }))
    const closedSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.closed ?? 0,
    }))
    return [
      { label: 'Open', data: openSeries, color: CHART_COLORS.amber },
      { label: 'In Progress', data: inProgressSeries, color: CHART_COLORS.cyan },
      { label: 'Closed', data: closedSeries, color: CHART_COLORS.emerald },
    ]
  }, [issuesData])

  // Average time-to-close from store issues
  const avgCloseTime = useMemo(() => {
    const closed = issues.filter(i => i.state === 'closed' && i.closedAt && i.createdAt)
    if (!closed.length) return null
    const total = closed.reduce((sum, i) => {
      const created = new Date(i.createdAt || i.created_at)
      const closedAt = new Date(i.closedAt || i.closed_at)
      return sum + (closedAt - created)
    }, 0)
    const avgMs = total / closed.length
    const hours = avgMs / (1000 * 60 * 60)
    if (hours < 24) return `${Math.round(hours)}h`
    return `${(hours / 24).toFixed(1)}d`
  }, [issues])

  // Agent activity: issues closed per agent
  const agentLeaderboard = useMemo(() => {
    if (!agentsData.length) return []
    const latest = agentsData[agentsData.length - 1]
    const agents = latest?.data || latest?.agents || []
    let entries = []
    if (Array.isArray(agents)) {
      entries = agents.map(a => ({
        label: a.name || a.id || 'Unknown',
        value: a.closedCount ?? a.taskCount ?? a.tasks ?? 0,
      }))
    } else {
      entries = Object.entries(agents).map(([name, info]) => ({
        label: name.charAt(0).toUpperCase() + name.slice(1),
        value: info?.closedCount ?? info?.taskCount ?? info?.tasks ?? 0,
      }))
    }
    return entries.sort((a, b) => b.value - a.value)
  }, [agentsData])

  // Actions minutes trend
  const actionsTrend = useMemo(() =>
    actionsData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.totalMinutes ?? snap.data?.minutes ?? snap.data?.totalRuns ?? 0,
    })),
    [actionsData],
  )

  // Projected monthly usage
  const projectedUsage = useMemo(() => {
    if (!actionsTrend.length) return null
    const totalMinutes = actionsTrend.reduce((sum, d) => sum + d.value, 0)
    const days = parseInt(timeRange) || 14
    const dailyAvg = totalMinutes / days
    const projected = Math.round(dailyAvg * 30)
    const freeLimit = 2000
    return { projected, freeLimit, dailyAvg: dailyAvg.toFixed(1), pctOfLimit: Math.round((projected / freeLimit) * 100) }
  }, [actionsTrend, timeRange])

  function handleRefresh() {
    fetchAllMetrics(timeRange)
  }

  if (loading && !issuesData.length && !agentsData.length && !actionsData.length) {
    return (
      <div className="space-y-6" data-testid="analytics-loading">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6 animate-pulse">
            <div className="h-64 bg-white/5 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="analytics-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">{'\u{1F4CA}'}</span> Analytics
          </h2>
          <p className="text-sm text-gray-400 mt-1">Sprint velocity, agent performance, and operational trends</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {TIME_RANGES.map(range => (
              <button
                key={range.id}
                onClick={() => handleTimeRangeChange(range.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-r border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border-r border-white/10 last:border-r-0'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <ExportButton endpoint="/api/export/metrics?channel=issues" label="Export" />
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 text-xs font-medium bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
          >
            {'\u{1F504}'} Refresh
          </button>
        </div>
      </div>

      {hasError && (
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
          <span className="text-xl">{'\u26A0\uFE0F'}</span>
          <span className="text-sm text-amber-300">
            Some analytics data failed to load. {metricsError}
          </span>
          <button
            onClick={handleRefresh}
            className="ml-auto px-3 py-1 text-xs bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={'\u{1F680}'}
          label="Sprint Throughput"
          value={sprintThroughput}
          subtitle="issues closed"
          color="emerald"
        />
        <KpiCard
          icon={'\u23F1\uFE0F'}
          label="Avg Close Time"
          value={avgCloseTime || '\u2014'}
          subtitle={avgCloseTime ? 'per issue' : 'no data'}
          color="cyan"
        />
        <KpiCard
          icon={'\u{1F451}'}
          label="Top Contributor"
          value={agentLeaderboard[0]?.label || '\u2014'}
          subtitle={agentLeaderboard[0] ? `${agentLeaderboard[0].value} closed` : 'no data'}
          color="purple"
        />
        <KpiCard
          icon={'\u26A1'}
          label="Projected Usage"
          value={projectedUsage ? `${projectedUsage.projected}m` : '\u2014'}
          subtitle={projectedUsage ? `${projectedUsage.pctOfLimit}% of free tier` : 'no data'}
          color={projectedUsage && projectedUsage.pctOfLimit > 80 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Sprint Velocity Chart */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">{'\u{1F4C8}'} Sprint Velocity</h3>
          <span className="text-xs text-gray-500 font-mono">Issues opened vs closed per day</span>
        </div>
        <div className="h-64">
          <AreaChart series={velocityData.series} timeRange={timeRange} />
        </div>
      </div>

      {/* Issue Lifecycle + Agent Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-6 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{'\u{1F4CB}'} Issue Lifecycle</h3>
          <div className="h-64">
            <AreaChart series={lifecycleSeries} timeRange={timeRange} />
          </div>
        </div>

        <div className="glass rounded-xl p-6 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{'\u{1F3C6}'} Agent Leaderboard</h3>
          {agentLeaderboard.length > 0 ? (
            <div className="space-y-3" data-testid="agent-leaderboard">
              {agentLeaderboard.map((agent, i) => {
                const maxVal = agentLeaderboard[0]?.value || 1
                const pct = Math.round((agent.value / maxVal) * 100)
                const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}']
                return (
                  <div key={agent.label} className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-white truncate">{agent.label}</span>
                        <span className="text-xs text-gray-400 ml-2">{agent.value} closed</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm" data-testid="leaderboard-empty">
              No agent activity data available
            </div>
          )}
        </div>
      </div>

      {/* Resource Usage Trends */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">{'\u26A1'} Resource Usage Trends</h3>
          {projectedUsage && (
            <span className={`text-xs font-mono px-2 py-1 rounded-full ${
              projectedUsage.pctOfLimit > 80
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              ~{projectedUsage.dailyAvg} min/day avg
            </span>
          )}
        </div>
        <div className="h-56">
          <TrendLine data={actionsTrend} label="Actions Minutes" color={CHART_COLORS.purple} timeRange={timeRange} />
        </div>
        {projectedUsage && projectedUsage.pctOfLimit > 80 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <span>{'\u26A0\uFE0F'}</span>
            Projected monthly usage ({projectedUsage.projected} min) exceeds 80% of free tier ({projectedUsage.freeLimit} min)
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, subtitle, color = 'cyan' }) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  }

  return (
    <div className={`glass rounded-xl p-4 border bg-gradient-to-br ${colorClasses[color] || colorClasses.cyan}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  )
}
