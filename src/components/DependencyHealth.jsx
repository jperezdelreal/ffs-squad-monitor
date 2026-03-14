import React, { useState, useEffect } from 'react'
import { useStore } from '../store/store'

const STATUS_STYLES = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Healthy' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-400', label: 'Degraded' },
  unhealthy: { dot: 'bg-red-500', text: 'text-red-400', label: 'Unhealthy' },
  unknown: { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Unknown' },
}

function DependencyRow({ name, icon, healthy, detail }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-gray-300">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-gray-500 font-mono">{detail}</span>}
        <div className={`w-2 h-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>
    </div>
  )
}

export function DependencyHealth() {
  const health = useStore((state) => state.health)
  const loading = useStore((state) => state.healthLoading)
  const fetchHealthData = useStore((state) => state.fetchHealthData)
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    fetchHealthData()
    const interval = setInterval(fetchHealthData, 30_000)
    return () => clearInterval(interval)
  }, [fetchHealthData])

  if (loading || !health) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-500 animate-pulse" />
        <span className="text-xs text-gray-500">Checking…</span>
      </div>
    )
  }

  const style = STATUS_STYLES[health.status] || STATUS_STYLES.unknown
  const deps = health.dependencies || {}
  const github = deps.github || {}
  const heartbeat = deps.heartbeat || {}

  const rateLimitDetail = github.rateLimit?.remaining != null
    ? `${github.rateLimit.remaining}/${github.rateLimit.limit}`
    : null

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(p => !p)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
        aria-label={`Dependencies: ${style.label}`}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        <span className={`text-xs font-medium ${style.text}`}>Deps</span>
      </button>

      {showPanel && (
        <div className="absolute top-full right-0 mt-2 w-72 p-3 rounded-lg glass border border-white/10 shadow-xl z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">Dependency Status</span>
            <button
              onClick={fetchHealthData}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Refresh health"
            >
              ↻
            </button>
          </div>

          <DependencyRow
            name="GitHub API"
            icon="🐙"
            healthy={github.reachable}
            detail={github.authenticated ? 'Authenticated' : 'Anonymous'}
          />
          <DependencyRow
            name="Rate Limit"
            icon="⏱️"
            healthy={github.rateLimit?.healthy !== false}
            detail={rateLimitDetail}
          />
          <DependencyRow
            name="Heartbeat File"
            icon="💓"
            healthy={heartbeat.fileAccessible}
            detail={heartbeat.status}
          />

          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/10">
            <span className="text-xs font-medium text-white">Overall</span>
            <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
          </div>
        </div>
      )}
    </div>
  )
}
