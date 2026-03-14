import React from 'react'
import { HealthBadge } from './HealthBadge'
import { ConnectionStatus } from './ConnectionStatus'
import { DependencyHealth } from './DependencyHealth'
import { NotificationBell } from './NotificationHistory'
import { ExportButton } from './ExportButton'
import { useTheme } from '../hooks/useTheme'

export function Header({ lastUpdate, isConnected, healthScore, healthLevel, healthBreakdown, sseStatus, onSSEReconnect, onMenuClick, exportButtonRef }) {
  const { theme, toggleTheme } = useTheme()
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
    <header className="glass border-b border-white/10 dark:border-white/10 light:border-black/10 px-3 sm:px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl">
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
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white dark:text-white light:text-gray-900 tracking-tight truncate">Squad Monitor</h1>
          <div className="hidden sm:block h-6 w-px bg-white/10 dark:bg-white/10 light:bg-black/10" />
          <span className="hidden sm:inline text-xs sm:text-sm text-gray-400 dark:text-gray-400 light:text-gray-500 font-mono truncate">FFS Operations</span>
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
          <div className="hidden md:block" ref={exportButtonRef}>
            <ExportButton endpoint="/api/events" label="Export" />
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <NotificationBell />
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 dark:text-gray-400 light:text-gray-500">
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
