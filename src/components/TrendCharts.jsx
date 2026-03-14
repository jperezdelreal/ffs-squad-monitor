import React, { useState, useMemo } from 'react'
import { TrendLine, BarChart, AreaChart } from './charts'
import { useMetrics } from '../hooks/useMetrics'

const TIME_RANGES = ['7d', '30d', '90d']

export function TrendCharts() {
  const [timeRange, setTimeRange] = useState('7d')

  const { data: issuesData, loading: issuesLoading, error: issuesError, refetch: refetchIssues } = useMetrics('issues', timeRange)
  const { data: agentsData, loading: agentsLoading, error: agentsError, refetch: refetchAgents } = useMetrics('agents', timeRange)
  const { data: actionsData, loading: actionsLoading, error: actionsError, refetch: refetchActions } = useMetrics('actions', timeRange)

  const loading = issuesLoading || agentsLoading || actionsLoading
  const hasError = issuesError || agentsError || actionsError

  const issuesTrend = useMemo(() =>
    issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.total ?? snap.data?.length ?? 0,
    })),
    [issuesData],
  )

  const issuesAreaSeries = useMemo(() => {
    const openSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.open ?? 0,
    }))
    const closedSeries = issuesData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.closed ?? 0,
    }))
    return [
      { label: 'Open', data: openSeries, color: '#f59e0b' },
      { label: 'Closed', data: closedSeries, color: '#10b981' },
    ]
  }, [issuesData])

  const agentBarData = useMemo(() => {
    if (!agentsData.length) return []
    const latest = agentsData[agentsData.length - 1]
    const agents = latest?.data || latest?.agents || []
    if (Array.isArray(agents)) {
      return agents.map(a => ({
        label: a.name || a.id || 'Unknown',
        value: a.taskCount ?? a.tasks ?? 0,
      }))
    }
    return Object.entries(agents).map(([name, info]) => ({
      label: name.charAt(0).toUpperCase() + name.slice(1),
      value: info?.taskCount ?? info?.tasks ?? 0,
    }))
  }, [agentsData])

  const actionsTrend = useMemo(() =>
    actionsData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.totalRuns ?? snap.data?.runs ?? snap.data?.count ?? 0,
    })),
    [actionsData],
  )

  function handleRefresh() {
    refetchIssues()
    refetchAgents()
    refetchActions()
  }

  if (loading && !issuesData.length && !agentsData.length && !actionsData.length) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6 animate-pulse">
            <div className="h-64 bg-white/5 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-xl sm:text-2xl">📈</span> Trend Analytics
          </h2>
          <p className="text-sm text-gray-400 mt-1">Historical metrics from the squad</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {TIME_RANGES.map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] ${
                  timeRange === range
                    ? 'bg-cyan-500/20 text-cyan-300 border-r border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border-r border-white/10 last:border-r-0'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 text-xs font-medium bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors min-h-[44px]"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {hasError && (
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span className="text-sm text-amber-300">
            Some metrics failed to load. {issuesError || agentsError || actionsError}
          </span>
          <button
            onClick={handleRefresh}
            className="ml-auto px-3 py-1 text-xs bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="glass rounded-xl p-4 sm:p-6 border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">📋 Issues Over Time</h3>
        <div className="h-48 sm:h-64">
          <TrendLine data={issuesTrend} label="Total Issues" color="#06b6d4" timeRange={timeRange} />
        </div>
      </div>

      <div className="glass rounded-xl p-4 sm:p-6 border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">📊 Open vs Closed Issues</h3>
        <div className="h-48 sm:h-64">
          <AreaChart series={issuesAreaSeries} timeRange={timeRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-6 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">👥 Tasks by Agent</h3>
          <div className="h-56">
            <BarChart data={agentBarData} title="Tasks" />
          </div>
        </div>
        <div className="glass rounded-xl p-6 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">⚡ Actions Runs</h3>
          <div className="h-56">
            <TrendLine data={actionsTrend} label="Workflow Runs" color="#a855f7" timeRange={timeRange} />
          </div>
        </div>
      </div>
    </div>
  )
}
