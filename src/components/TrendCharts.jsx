import React, { useEffect, useMemo } from 'react'
import { TrendLine, BarChart, AreaChart } from './charts'
import { useStore } from '../store/store'
import { SkeletonChart } from './Skeleton'
import { ErrorState } from './ErrorState'

const TIME_RANGES = ['7d', '30d', '90d']

export function TrendCharts() {
  const metricsIssues = useStore((state) => state.metricsIssues)
  const metricsAgents = useStore((state) => state.metricsAgents)
  const metricsActions = useStore((state) => state.metricsActions)
  const metricsLoading = useStore((state) => state.metricsLoading)
  const metricsError = useStore((state) => state.metricsError)
  const metricsTimeRange = useStore((state) => state.metricsTimeRange)
  const fetchAllMetrics = useStore((state) => state.fetchAllMetrics)

  useEffect(() => {
    fetchAllMetrics(metricsTimeRange)
  }, [metricsTimeRange])

  const issuesData = metricsIssues
  const agentsData = metricsAgents
  const actionsData = metricsActions
  const loading = metricsLoading
  const hasError = !!metricsError

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

  const labelsData = useMemo(() => [], [])

  const actionsTrend = useMemo(() =>
    actionsData.map(snap => ({
      timestamp: snap.timestamp,
      value: snap.data?.totalRuns ?? snap.data?.runs ?? snap.data?.count ?? 0,
    })),
    [actionsData],
  )

  function handleRefresh() {
    fetchAllMetrics(metricsTimeRange)
  }

  function handleTimeRangeChange(range) {
    useStore.setState({ metricsTimeRange: range })
  }

  if (loading && !issuesData.length && !agentsData.length && !actionsData.length) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <SkeletonChart key={i} />
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
                onClick={() => handleTimeRangeChange(range)}
                className={`px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] ${
                  metricsTimeRange === range
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
        <ErrorState
          title="Metrics Error"
          message="Failed to load trend data. Historical charts may be incomplete."
          error={metricsError}
          retry={handleRefresh}
          retryLabel="Retry"
          showDetails={false}
          className="mb-4"
        />
      )}

      <div className="glass rounded-xl p-4 sm:p-6 border border-white/10 snap-start">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">📋 Issues Over Time</h3>
        <div className="h-56 sm:h-64 md:h-72">
          <TrendLine data={issuesTrend} label="Total Issues" color="#06b6d4" timeRange={metricsTimeRange} />
        </div>
      </div>

      <div className="glass rounded-xl p-4 sm:p-6 border border-white/10 snap-start">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">📊 Open vs Closed Issues</h3>
        <div className="h-56 sm:h-64 md:h-72">
          <AreaChart series={issuesAreaSeries} timeRange={metricsTimeRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 snap-start">
        <div className="glass rounded-xl p-6 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">👥 Tasks by Agent</h3>
          <div className="h-56 sm:h-64 md:h-72">
            <BarChart series={agentBarData} label="Active Tasks" />
          </div>
        </div>

        <div className="glass rounded-xl p-6 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">🏷️ Tasks by Label</h3>
          <div className="h-56 sm:h-64 md:h-72">
            <BarChart series={labelsData} label="Task Count" />
          </div>
        </div>
      </div>
    </div>
  )
}


export default TrendCharts
