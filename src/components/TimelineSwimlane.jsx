import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useStore } from '../store/store'
import { SkeletonContainer, SkeletonTimelineBar } from './Skeleton'

const TIME_RANGES = [
  { id: '24h', label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '14d', label: 'Last 14 days', ms: 14 * 24 * 60 * 60 * 1000 },
]

const STATUS_COLORS = {
  completed: { bg: 'bg-emerald-500/30', border: 'border-emerald-500/50', text: 'text-emerald-300', fill: '#10b981' },
  'in-progress': { bg: 'bg-cyan-500/30', border: 'border-cyan-500/50', text: 'text-cyan-300', fill: '#06b6d4' },
  blocked: { bg: 'bg-rose-500/30', border: 'border-rose-500/50', text: 'text-rose-300', fill: '#f43f5e' },
  idle: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', fill: '#6b7280' },
}

function getAgentIdFromLabels(labels) {
  if (!labels) return null
  for (const label of labels) {
    const name = typeof label === 'string' ? label : label?.name
    const match = name?.match(/^squad:(.+)$/)
    if (match) return match[1].toLowerCase()
  }
  return null
}

function getTaskStatus(issue) {
  const labels = issue.labels || []
  if (issue.state === 'closed') return 'completed'
  const hasBlocked = labels.some(l => {
    const name = typeof l === 'string' ? l : l?.name
    return name?.startsWith('blocked-by:')
  })
  if (hasBlocked) return 'blocked'
  return 'in-progress'
}

function formatDuration(ms) {
  if (ms < 0) return '\u2014'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`
  if (hours < 24) return `${hours}h`
  const days = (hours / 24).toFixed(1)
  return `${days}d`
}

function formatTickLabel(date, rangeId) {
  if (rangeId === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function generateTicks(rangeStart, rangeEnd, rangeId) {
  const ticks = []
  const intervalMs = rangeId === '24h'
    ? 3 * 60 * 60 * 1000
    : rangeId === '7d'
      ? 24 * 60 * 60 * 1000
      : 2 * 24 * 60 * 60 * 1000

  let current = new Date(Math.ceil(rangeStart / intervalMs) * intervalMs)
  while (current.getTime() <= rangeEnd) {
    ticks.push(current.getTime())
    current = new Date(current.getTime() + intervalMs)
  }
  return ticks
}

export function TimelineSwimlane() {
  const { issues, agents, issuesLoading, agentsLoading, fetchIssues, fetchAgents } = useStore()
  const [timeRange, setTimeRange] = useState('7d')
  const [hiddenAgents, setHiddenAgents] = useState(new Set())
  const [tooltip, setTooltip] = useState(null)
  const [zoom, setZoom] = useState(1)
  const timelineRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, scrollLeft: 0 })

  useEffect(() => {
    if (!issues.length) fetchIssues()
    if (!agents.length) fetchAgents()
  }, [])

  const rangeConfig = TIME_RANGES.find(r => r.id === timeRange) || TIME_RANGES[1]
  const now = Date.now()
  const rangeStart = now - rangeConfig.ms
  const rangeEnd = now
  const rangeDuration = rangeEnd - rangeStart

  // Build task bars from issues
  const tasksByAgent = useMemo(() => {
    const map = new Map()
    agents.forEach(a => map.set(a.id, []))

    issues.forEach(issue => {
      const agentId = getAgentIdFromLabels(issue.labels)
      if (!agentId) return

      const start = new Date(issue.createdAt || issue.created_at).getTime()
      const end = issue.state === 'closed'
        ? new Date(issue.closedAt || issue.closed_at || now).getTime()
        : now
      const status = getTaskStatus(issue)

      if (end < rangeStart || start > rangeEnd) return

      const clampedStart = Math.max(start, rangeStart)
      const clampedEnd = Math.min(end, rangeEnd)

      if (!map.has(agentId)) map.set(agentId, [])
      map.get(agentId).push({
        id: issue.number || issue.id,
        title: issue.title,
        number: issue.number,
        url: issue.url || issue.html_url,
        status,
        start: clampedStart,
        end: clampedEnd,
        rawStart: start,
        rawEnd: end,
        duration: end - start,
        repo: issue.repoLabel || issue.repo || '',
      })
    })

    for (const [, tasks] of map) {
      tasks.sort((a, b) => a.start - b.start)
    }

    return map
  }, [issues, agents, timeRange, rangeStart, rangeEnd])

  const visibleAgents = useMemo(
    () => agents.filter(a => !hiddenAgents.has(a.id)),
    [agents, hiddenAgents],
  )

  const ticks = useMemo(
    () => generateTicks(rangeStart, rangeEnd, timeRange),
    [rangeStart, rangeEnd, timeRange],
  )

  const toggleAgent = useCallback((agentId) => {
    setHiddenAgents(prev => {
      const next = new Set(prev)
      next.has(agentId) ? next.delete(agentId) : next.add(agentId)
      return next
    })
  }, [])

  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom(prev => {
      const next = prev + (e.deltaY < 0 ? 0.25 : -0.25)
      return Math.max(0.5, Math.min(4, next))
    })
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (!timelineRef.current) return
    setIsDragging(true)
    dragRef.current = {
      startX: e.pageX - timelineRef.current.offsetLeft,
      scrollLeft: timelineRef.current.scrollLeft,
    }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !timelineRef.current) return
    e.preventDefault()
    const x = e.pageX - timelineRef.current.offsetLeft
    const walk = (x - dragRef.current.startX) * 1.5
    timelineRef.current.scrollLeft = dragRef.current.scrollLeft - walk
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch event handlers for mobile drag support
  const handleTouchStart = useCallback((e) => {
    if (!timelineRef.current) return
    setIsDragging(true)
    dragRef.current = {
      startX: e.touches[0].pageX - timelineRef.current.offsetLeft,
      scrollLeft: timelineRef.current.scrollLeft,
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !timelineRef.current) return
    e.preventDefault()
    const x = e.touches[0].pageX - timelineRef.current.offsetLeft
    const walk = (x - dragRef.current.startX) * 1.5
    timelineRef.current.scrollLeft = dragRef.current.scrollLeft - walk
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const totalTasks = useMemo(() => {
    let count = 0
    for (const [, tasks] of tasksByAgent) count += tasks.length
    return count
  }, [tasksByAgent])

  const loading = issuesLoading || agentsLoading

  if (loading && !issues.length) {
    return (
      <div className="space-y-6" data-testid="timeline-loading">
        {[...Array(3)].map((_, i) => (
          <SkeletonContainer key={i}>
            <SkeletonTimelineBar />
          </SkeletonContainer>
        ))}
      </div>
    )
  }

  if (!agents.length) {
    return (
      <div className="glass rounded-xl p-12 border border-white/10 text-center" data-testid="timeline-empty">
        <span className="text-4xl block mb-4">{'\u{1F4C5}'}</span>
        <h3 className="text-lg font-semibold text-white mb-2">No Timeline Data</h3>
        <p className="text-sm text-gray-400">No agent activity found. Agents will appear here once issues are assigned.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="timeline-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-xl sm:text-2xl">{'\u{1F3AC}'}</span> Timeline Swimlane
          </h2>
          <p className="text-sm text-gray-400 mt-1">Gantt-style agent activity over time</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {TIME_RANGES.map(range => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] ${
                  timeRange === range.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-r border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border-r border-white/10 last:border-r-0'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Zoom out"
              aria-label="Zoom out timeline"
            >
              {'\u2212'}
            </button>
            <span className="px-2 font-mono text-gray-400">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Zoom in"
              aria-label="Zoom in timeline"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Legend + Agent Filter */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/50 border border-emerald-500/70" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-cyan-500/50 border border-cyan-500/70" /> In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500/50 border border-rose-500/70" /> Blocked
          </span>
        </div>
        <div className="hidden sm:block h-4 w-px bg-white/10" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              className={`px-2 py-1 rounded-full border transition-colors min-h-[44px] ${
                hiddenAgents.has(agent.id)
                  ? 'bg-white/5 border-white/10 text-gray-600 line-through'
                  : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/15'
              }`}
            >
              {agent.emoji || '\u{1F916}'} {agent.name}
            </button>
          ))}
        </div>
      </div>

      {/* Swimlane Chart */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        {/* Time axis header */}
        <div className="flex border-b border-white/10">
          <div className="w-40 min-w-[10rem] shrink-0 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-white/10">
            Agent
          </div>
          <div
            className="flex-1 relative overflow-hidden"
            style={{ minWidth: `${Math.max(600, 800 * zoom)}px` }}
          >
            <div className="flex h-full">
              {ticks.map((tick, i) => {
                const pct = ((tick - rangeStart) / rangeDuration) * 100
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 flex flex-col items-center"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="text-[10px] text-gray-500 font-mono py-1 whitespace-nowrap px-1">
                      {formatTickLabel(new Date(tick), timeRange)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Swimlane rows */}
        <div
          ref={timelineRef}
          className={`overflow-x-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-pan-x`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {visibleAgents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500" data-testid="timeline-no-agents">
              All agents are filtered out. Click an agent above to show them.
            </div>
          ) : (
            visibleAgents.map((agent, idx) => {
              const tasks = tasksByAgent.get(agent.id) || []
              return (
                <div
                  key={agent.id}
                  className={`flex border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                    idx % 2 === 0 ? 'bg-white/[0.01]' : ''
                  }`}
                  data-testid={`swimlane-${agent.id}`}
                >
                  {/* Agent label */}
                  <div className="w-40 min-w-[10rem] shrink-0 px-4 py-3 border-r border-white/10 flex items-center gap-2">
                    <span className="text-lg">{agent.emoji || '\u{1F916}'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{agent.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{agent.role}</div>
                    </div>
                  </div>

                  {/* Timeline lane */}
                  <div
                    className="flex-1 relative py-2"
                    style={{ minWidth: `${Math.max(600, 800 * zoom)}px`, minHeight: '48px' }}
                  >
                    {/* Tick gridlines */}
                    {ticks.map((tick, i) => {
                      const pct = ((tick - rangeStart) / rangeDuration) * 100
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-white/5"
                          style={{ left: `${pct}%` }}
                        />
                      )
                    })}

                    {/* "Now" marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-cyan-500/30"
                      style={{ left: '100%' }}
                    />

                    {/* Task bars */}
                    {tasks.length === 0 ? (
                      <div className="flex items-center h-full px-4">
                        <span className="text-[10px] text-gray-600 italic">No activity in this period</span>
                      </div>
                    ) : (
                      tasks.map((task) => {
                        const leftPct = ((task.start - rangeStart) / rangeDuration) * 100
                        const widthPct = ((task.end - task.start) / rangeDuration) * 100
                        const colors = STATUS_COLORS[task.status] || STATUS_COLORS.idle
                        const minWidthPx = 4

                        return (
                          <div
                            key={task.id}
                            className={`absolute top-2 h-8 rounded-md ${colors.bg} border ${colors.border} hover:brightness-125 transition-all cursor-pointer group`}
                            style={{
                              left: `${leftPct}%`,
                              width: `max(${minWidthPx}px, ${widthPct}%)`,
                            }}
                            onClick={() => task.url && window.open(task.url, '_blank', 'noopener')}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setTooltip({
                                task,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 8,
                              })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {widthPct > 5 && (
                              <div className={`px-2 h-full flex items-center overflow-hidden ${colors.text}`}>
                                <span className="text-[10px] font-medium truncate">
                                  #{task.number} {task.title}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {totalTasks} task{totalTasks !== 1 ? 's' : ''} across {visibleAgents.length} agent{visibleAgents.length !== 1 ? 's' : ''}
        </span>
        <span className="font-mono">
          Ctrl+Scroll to zoom {'\u00B7'} Drag to pan
        </span>
      </div>

      {/* Tooltip portal */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="glass rounded-lg p-3 border border-white/20 shadow-xl shadow-black/40 max-w-xs">
            <div className="text-sm font-semibold text-white mb-1">
              #{tooltip.task.number} {tooltip.task.title}
            </div>
            {tooltip.task.repo && (
              <div className="text-[10px] text-gray-500 mb-2 font-mono">{tooltip.task.repo}</div>
            )}
            <div className="flex items-center gap-3 text-xs">
              <span className={`px-1.5 py-0.5 rounded-full ${STATUS_COLORS[tooltip.task.status]?.bg} ${STATUS_COLORS[tooltip.task.status]?.text} border ${STATUS_COLORS[tooltip.task.status]?.border}`}>
                {tooltip.task.status}
              </span>
              <span className="text-gray-400">
                {'\u23F1\uFE0F'} {formatDuration(tooltip.task.duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
