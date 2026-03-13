import React from 'react'
import { formatAge } from '../lib/health'

/**
 * Alert banner for heartbeat staleness.
 * Shows when heartbeat is 'stale' (missed recent update) or 'dead' (no update in 30+ min).
 * Hidden when heartbeat is fresh.
 */
export function StalenessAlert({ staleness, heartbeatAgeMs }) {
  if (staleness === 'fresh') return null

  const isDead = staleness === 'dead'
  const ageText = heartbeatAgeMs != null ? formatAge(heartbeatAgeMs) : 'unknown'

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-6 py-3 border-b ${
        isDead
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}
    >
      <span className={`text-lg ${isDead ? 'animate-pulse' : 'animate-bounce'}`}>
        {isDead ? '💀' : '⚠️'}
      </span>
      <div className="flex-1">
        <span className={`text-sm font-semibold ${isDead ? 'text-red-400' : 'text-amber-400'}`}>
          {isDead ? 'Heartbeat Dead' : 'Heartbeat Stale'}
        </span>
        <span className="text-sm text-gray-400 ml-2">
          {isDead
            ? `No heartbeat received in ${ageText}. The scheduler may be stopped.`
            : `Last heartbeat was ${ageText} ago. Monitoring may be delayed.`
          }
        </span>
      </div>
      <span className={`text-xs font-mono px-2 py-1 rounded ${
        isDead ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
      }`}>
        {ageText}
      </span>
    </div>
  )
}
