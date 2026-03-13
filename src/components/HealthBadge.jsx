import React, { useState } from 'react'
import { HEALTH_LEVELS } from '../lib/health'

const LEVEL_STYLES = {
  [HEALTH_LEVELS.GREEN]: {
    dot: 'bg-emerald-500',
    ping: 'bg-emerald-500',
    text: 'text-emerald-400',
    label: 'Healthy',
  },
  [HEALTH_LEVELS.YELLOW]: {
    dot: 'bg-amber-500',
    ping: 'bg-amber-500',
    text: 'text-amber-400',
    label: 'Degraded',
  },
  [HEALTH_LEVELS.RED]: {
    dot: 'bg-red-500',
    ping: 'bg-red-500',
    text: 'text-red-400',
    label: 'Unhealthy',
  },
}

export function HealthBadge({ score, level, breakdown }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const style = LEVEL_STYLES[level] || LEVEL_STYLES[HEALTH_LEVELS.RED]

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 cursor-default"
        role="status"
        aria-label={`Health: ${style.label} (${score}%)`}
      >
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
          {level !== HEALTH_LEVELS.RED && (
            <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${style.ping} animate-ping opacity-75`} />
          )}
        </div>
        <span className={`text-xs font-medium ${style.text}`}>
          {score}%
        </span>
      </div>

      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-64 p-3 rounded-lg glass border border-white/10 shadow-xl z-50">
          <div className="text-xs font-semibold text-white mb-2">
            Health Breakdown
          </div>
          {breakdown.map((factor) => (
            <div key={factor.label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
              <span className="text-xs text-gray-400">{factor.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 font-mono">{factor.value}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${factor.score >= 70 ? 'bg-emerald-500' : factor.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/10">
            <span className="text-xs font-medium text-white">Overall</span>
            <span className={`text-xs font-bold ${style.text}`}>{score}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
