import React from 'react'
import { HealthBadge } from './HealthBadge'
import { ConnectionStatus } from './ConnectionStatus'
import { DependencyHealth } from './DependencyHealth'
import { NotificationBell } from './NotificationHistory'

export function Header({ lastUpdate, isConnected, healthScore, healthLevel, healthBreakdown, sseStatus, onSSEReconnect }) {
  const getTimeSince = () => {
    if (!lastUpdate) return 'Never'
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <header className="glass border-b border-white/10 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">Squad Monitor</h1>
          <div className="h-6 w-px bg-white/10" />
          <span className="text-sm text-gray-400 font-mono">FFS Operations</span>
        </div>
        <div className="flex items-center gap-6">
          <HealthBadge score={healthScore} level={healthLevel} breakdown={healthBreakdown} />
          <DependencyHealth />
          <ConnectionStatus
            sseStatus={sseStatus}
            lastUpdate={lastUpdate}
            onReconnect={onSSEReconnect}
          />
          <NotificationBell />
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono text-xs">{getTimeSince()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
