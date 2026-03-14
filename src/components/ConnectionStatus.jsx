import React, { useState } from 'react'

const STATUS_CONFIG = {
  streaming: {
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/20',
    bgClass: 'bg-emerald-500/10',
    label: 'Streaming',
    icon: 'double-dot',
    animation: 'animate-pulse-gentle',
  },
  reconnecting: {
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
    bgClass: 'bg-amber-500/10',
    label: 'Reconnecting\u2026',
    icon: 'spin',
    animation: 'animate-spin-slow',
  },
  polling: {
    dotClass: 'bg-blue-400',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/20',
    bgClass: 'bg-blue-500/10',
    label: 'Polling',
    icon: 'single-dot',
    animation: 'animate-pulse-slow',
  },
  disconnected: {
    dotClass: 'bg-red-500',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/20',
    bgClass: 'bg-red-500/10',
    label: 'Offline',
    icon: 'hollow-dot',
    animation: '',
  },
  connecting: {
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
    bgClass: 'bg-amber-500/10',
    label: 'Connecting\u2026',
    icon: 'spin',
    animation: 'animate-spin-slow',
  },
}

function StatusIcon({ type, animation, dotClass }) {
  if (type === 'spin') {
    return (
      <svg
        className={`w-3.5 h-3.5 ${animation}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        data-testid="icon-spin"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    )
  }

  if (type === 'double-dot') {
    return (
      <div className="flex items-center gap-0.5" data-testid="icon-double-dot">
        <div className={`w-1.5 h-1.5 rounded-full ${dotClass} ${animation}`} />
        <div className={`w-1.5 h-1.5 rounded-full ${dotClass} ${animation}`} style={{ animationDelay: '0.5s' }} />
      </div>
    )
  }

  if (type === 'hollow-dot') {
    return (
      <div
        className="w-2 h-2 rounded-full border-2 border-red-500"
        data-testid="icon-hollow-dot"
      />
    )
  }

  // single-dot (polling)
  return (
    <div className={`w-2 h-2 rounded-full ${dotClass} ${animation}`} data-testid="icon-single-dot" />
  )
}

function getTimeSince(timestamp) {
  if (!timestamp) return 'N/A'
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function ConnectionStatus({ sseStatus, lastUpdate, onReconnect }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const status = sseStatus || 'disconnected'
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected

  const isClickable = status !== 'streaming'

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={isClickable ? onReconnect : undefined}
        disabled={!isClickable}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full
          ${config.bgClass} border ${config.borderClass}
          text-xs font-medium ${config.textClass}
          transition-all duration-300 ease-in-out
          ${isClickable ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}
          disabled:opacity-100
        `}
        aria-label={`Connection status: ${config.label}`}
        data-testid="connection-status"
      >
        <StatusIcon type={config.icon} animation={config.animation} dotClass={config.dotClass} />
        <span>{config.label}</span>
      </button>

      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-56 p-3 rounded-lg glass border border-white/10 shadow-xl z-50">
          <div className="text-xs font-semibold text-white mb-2">
            Connection Details
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Mode</span>
              <span className={`text-xs font-mono ${config.textClass}`}>
                {status === 'streaming' ? 'SSE' : status === 'polling' ? 'HTTP Polling' : status === 'disconnected' ? 'None' : 'SSE (retry)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Last event</span>
              <span className="text-xs font-mono text-gray-300">
                {getTimeSince(lastUpdate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Status</span>
              <span className={`text-xs font-mono ${config.textClass}`}>
                {config.label}
              </span>
            </div>
          </div>
          {isClickable && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <span className="text-[10px] text-gray-500">Click to reconnect SSE</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
