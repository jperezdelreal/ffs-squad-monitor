import React, { useEffect, useRef } from 'react'
import { useStore } from '../store/store'

const SEVERITY_CONFIG = {
  critical: { icon: '🔴', border: 'border-l-red-500', label: 'Critical' },
  warning:  { icon: '⚠️', border: 'border-l-amber-500', label: 'Warning' },
  success:  { icon: '✅', border: 'border-l-emerald-500', label: 'Success' },
  info:     { icon: 'ℹ️', border: 'border-l-blue-500', label: 'Info' },
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationItem({ notification }) {
  const cfg = SEVERITY_CONFIG[notification.severity] || SEVERITY_CONFIG.info

  return (
    <div
      className={`border-l-4 ${cfg.border} bg-white/5 rounded-r-lg p-3 transition-all hover:bg-white/10 ${
        !notification.read ? 'ring-1 ring-white/10' : 'opacity-80'
      }`}
      style={{ animation: 'slideDown 0.25s ease-out' }}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5 shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-medium truncate ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
              {notification.title}
            </span>
            <span className="text-[10px] text-gray-500 shrink-0 font-mono">
              {formatRelativeTime(notification.timestamp)}
            </span>
          </div>
          {notification.body && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.body}</p>
          )}
          {notification.link && (
            <a
              href={notification.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] text-cyan-400 hover:text-cyan-300 mt-1.5 transition-colors"
            >
              View details →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const unreadCount = useStore(s => s.unreadCount)
  const togglePanel = useStore(s => s.toggleNotificationPanel)

  return (
    <button
      onClick={togglePanel}
      className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg shadow-red-500/30"
          style={{ animation: 'badgeBounce 0.4s ease-out' }}
          key={unreadCount}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export function NotificationHistory() {
  const panelRef = useRef(null)
  const show = useStore(s => s.showNotificationPanel)
  const notifications = useStore(s => s.notifications)
  const markAllRead = useStore(s => s.markAllRead)
  const clearNotifications = useStore(s => s.clearNotifications)
  const closeAllPanels = useStore(s => s.closeAllPanels)

  // Close on Escape
  useEffect(() => {
    if (!show) return
    const onKey = (e) => { if (e.key === 'Escape') closeAllPanels() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, closeAllPanels])

  // Close on outside click
  useEffect(() => {
    if (!show) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closeAllPanels()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', onClick), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onClick)
    }
  }, [show, closeAllPanels])

  if (!show) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-96 z-50 glass border-l border-white/10 flex flex-col"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔔</span>
              <h2 className="text-lg font-bold text-white">Notifications</h2>
              {notifications.length > 0 && (
                <span className="text-xs text-gray-500 font-mono">({notifications.length})</span>
              )}
            </div>
            <button
              onClick={closeAllPanels}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close notifications"
            >
              ✕
            </button>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={markAllRead}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
              >
                Mark all as read
              </button>
              <button
                onClick={clearNotifications}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-4xl mb-3">🔕</span>
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs text-gray-600 mt-1">Alerts will appear here when triggered</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes badgeBounce {
          0%   { transform: scale(0.5); }
          50%  { transform: scale(1.2); }
          100% { transform: scale(1);   }
        }
      `}</style>
    </>
  )
}
