import { useEffect } from 'react'

const SHORTCUTS = [
  { key: '/', description: 'Focus search input', category: 'Navigation' },
  { key: 'r', description: 'Refresh all data', category: 'Actions' },
  { key: 'e', description: 'Open export dialog', category: 'Actions' },
  { key: '1', description: 'Activity Feed', category: 'Views' },
  { key: '2', description: 'Pipeline Visualizer', category: 'Views' },
  { key: '3', description: 'Team Board', category: 'Views' },
  { key: '4', description: 'Timeline Swimlane', category: 'Views' },
  { key: '5', description: 'Trend Charts', category: 'Views' },
  { key: '6', description: 'Cost Tracker', category: 'Views' },
  { key: '7', description: 'Analytics', category: 'Views' },
  { key: '?', description: 'Show keyboard shortcuts', category: 'Help' },
  { key: 'Esc', description: 'Close modals/overlays', category: 'Navigation' },
]

const VIEW_MAP = {
  '1': 'activity',
  '2': 'pipeline',
  '3': 'team',
  '4': 'timeline',
  '5': 'charts',
  '6': 'cost',
  '7': 'analytics',
}

export function useKeyboardShortcuts({
  onViewChange,
  onRefresh,
  onOpenExport,
  onToggleShortcuts,
  shortcutsOpen,
  settingsOpen,
  notificationsOpen,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow Escape to blur input
        if (e.key === 'Escape') {
          e.target.blur()
        }
        return
      }

      // Ignore shortcuts if modifiers are pressed (except Escape)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      // Handle Escape key
      if (e.key === 'Escape') {
        if (shortcutsOpen || settingsOpen || notificationsOpen) {
          onToggleShortcuts()
        }
        return
      }

      // Handle ? key to show shortcuts
      if (e.key === '?' && !shortcutsOpen) {
        e.preventDefault()
        onToggleShortcuts()
        return
      }

      // Prevent shortcuts when any panel is open
      if (shortcutsOpen || settingsOpen || notificationsOpen) {
        return
      }

      // Handle view navigation (1-7)
      if (VIEW_MAP[e.key]) {
        e.preventDefault()
        onViewChange(VIEW_MAP[e.key])
        return
      }

      // Handle / for search focus
      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector('input[type="text"]')
        if (searchInput) {
          searchInput.focus()
        }
        return
      }

      // Handle r for refresh
      if (e.key === 'r') {
        e.preventDefault()
        onRefresh()
        return
      }

      // Handle e for export
      if (e.key === 'e') {
        e.preventDefault()
        onOpenExport()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    onViewChange,
    onRefresh,
    onOpenExport,
    onToggleShortcuts,
    shortcutsOpen,
    settingsOpen,
    notificationsOpen,
  ])

  return { shortcuts: SHORTCUTS }
}
