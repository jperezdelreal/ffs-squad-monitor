import React from 'react'
import { HealthBadge } from './HealthBadge'
import { ConnectionStatus } from './ConnectionStatus'
import { DependencyHealth } from './DependencyHealth'
import { NotificationBell } from './NotificationHistory'

export function Header({ lastUpdate, isConnected, healthScore, healthLevel, healthBreakdown, sseStatus, onSSEReconnect, onMenuClick }) {
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
    <header className="glass border-b border-white/10 px-3 sm:px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate">Squad Monitor</h1>
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <span className="hidden sm:inline text-xs sm:text-sm text-gray-400 font-mono truncate">FFS Operations</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 md:gap-6">
          <div className="hidden md:block">
            <HealthBadge score={healthScore} level={healthLevel} breakdown={healthBreakdown} />
          </div>
          <div className="hidden lg:block">
            <DependencyHealth />
          </div>
          <div className="hidden sm:block">
            <ConnectionStatus
              sseStatus={sseStatus}
              lastUpdate={lastUpdate}
              onReconnect={onSSEReconnect}
            />
          </div>
          <NotificationBell />
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
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
