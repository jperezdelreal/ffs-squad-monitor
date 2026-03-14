import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/store'
import { 
  MagnifyingGlassIcon, 
  HomeIcon, 
  ChartBarIcon, 
  UsersIcon, 
  ClockIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ArrowDownTrayIcon,
  CommandLineIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

const ICON_MAP = {
  activity: HomeIcon,
  pipeline: ChartBarIcon,
  team: UsersIcon,
  timeline: ClockIcon,
  charts: ChartBarIcon,
  cost: CurrencyDollarIcon,
  analytics: ChartPieIcon,
  refresh: ArrowPathIcon,
  settings: Cog6ToothIcon,
  'toggle-theme': SunIcon,
  export: ArrowDownTrayIcon,
  shortcuts: CommandLineIcon,
}

// Recent actions stored in localStorage
const RECENT_ACTIONS_KEY = 'ffs-command-palette-recent'
const MAX_RECENT = 5

function getRecentActions() {
  try {
    const raw = localStorage.getItem(RECENT_ACTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addRecentAction(actionId) {
  try {
    const recent = getRecentActions()
    const filtered = recent.filter(id => id !== actionId)
    const updated = [actionId, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(updated))
  } catch {
    // localStorage may be unavailable
  }
}

export function CommandPalette({ isOpen, onClose, onViewChange, onRefresh, onToggleTheme, onOpenSettings, onOpenShortcuts, onOpenExport }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentActions, setRecentActions] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const settings = useStore((state) => state.settings)
  const isDark = !document.documentElement.classList.contains('light')

  // Define all available commands
  const commands = useMemo(() => [
    // Navigation
    { id: 'nav-activity', label: 'Activity Feed', category: 'Navigation', icon: 'activity', action: () => onViewChange('activity') },
    { id: 'nav-pipeline', label: 'Pipeline Visualizer', category: 'Navigation', icon: 'pipeline', action: () => onViewChange('pipeline') },
    { id: 'nav-team', label: 'Team Board', category: 'Navigation', icon: 'team', action: () => onViewChange('team') },
    { id: 'nav-timeline', label: 'Timeline Swimlane', category: 'Navigation', icon: 'timeline', action: () => onViewChange('timeline') },
    { id: 'nav-charts', label: 'Trend Charts', category: 'Navigation', icon: 'charts', action: () => onViewChange('charts') },
    { id: 'nav-cost', label: 'Cost Tracker', category: 'Navigation', icon: 'cost', action: () => onViewChange('cost') },
    { id: 'nav-analytics', label: 'Analytics Dashboard', category: 'Navigation', icon: 'analytics', action: () => onViewChange('analytics') },
    
    // Actions
    { id: 'action-refresh', label: 'Refresh All Data', category: 'Actions', icon: 'refresh', action: onRefresh },
    { id: 'action-export', label: 'Export Data', category: 'Actions', icon: 'export', action: onOpenExport },
    { id: 'action-toggle-theme', label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode', category: 'Actions', icon: 'toggle-theme', action: onToggleTheme },
    
    // Settings
    { id: 'settings-open', label: 'Open Settings', category: 'Settings', icon: 'settings', action: onOpenSettings },
    { id: 'settings-shortcuts', label: 'Show Keyboard Shortcuts', category: 'Settings', icon: 'shortcuts', action: onOpenShortcuts },
  ], [onViewChange, onRefresh, onToggleTheme, onOpenSettings, onOpenShortcuts, onOpenExport, isDark])

  // Fuzzy search filter
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    const lowerQuery = query.toLowerCase()
    return commands.filter(cmd => {
      const label = cmd.label.toLowerCase()
      const category = cmd.category.toLowerCase()
      
      // Simple fuzzy match: check if all query characters appear in order
      let queryIndex = 0
      for (let i = 0; i < label.length && queryIndex < lowerQuery.length; i++) {
        if (label[i] === lowerQuery[queryIndex]) {
          queryIndex++
        }
      }
      
      // Also match on category or simple includes
      return queryIndex === lowerQuery.length || label.includes(lowerQuery) || category.includes(lowerQuery)
    })
  }, [commands, query])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Build flat list for arrow navigation
  const flatCommands = useMemo(() => {
    const categoryOrder = ['Recent', 'Navigation', 'Actions', 'Settings']
    const flat = []
    
    // Add recent actions first if no query
    if (!query.trim() && recentActions.length > 0) {
      const recent = recentActions
        .map(id => commands.find(cmd => cmd.id === id))
        .filter(Boolean)
      if (recent.length > 0) {
        flat.push({ type: 'category', label: 'Recent' })
        recent.forEach(cmd => flat.push({ type: 'command', data: cmd }))
      }
    }
    
    // Add other categories
    categoryOrder.forEach(category => {
      if (category === 'Recent') return
      if (groupedCommands[category] && groupedCommands[category].length > 0) {
        flat.push({ type: 'category', label: category })
        groupedCommands[category].forEach(cmd => flat.push({ type: 'command', data: cmd }))
      }
    })
    
    return flat
  }, [groupedCommands, commands, recentActions, query])

  // Load recent actions on mount
  useEffect(() => {
    if (isOpen) {
      setRecentActions(getRecentActions())
    }
  }, [isOpen])

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => {
          const commandItems = flatCommands.filter(item => item.type === 'command')
          const currentCommandIndex = commandItems.findIndex((_, idx) => {
            let commandCount = 0
            for (let i = 0; i <= prev; i++) {
              if (flatCommands[i]?.type === 'command') commandCount++
            }
            return commandCount - 1 === idx
          })
          if (currentCommandIndex < commandItems.length - 1) {
            // Find next command in flat list
            for (let i = prev + 1; i < flatCommands.length; i++) {
              if (flatCommands[i].type === 'command') return i
            }
          }
          return prev
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => {
          if (prev > 0) {
            // Find previous command in flat list
            for (let i = prev - 1; i >= 0; i--) {
              if (flatCommands[i].type === 'command') return i
            }
          }
          return prev
        })
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const selectedItem = flatCommands[selectedIndex]
        if (selectedItem?.type === 'command') {
          executeCommand(selectedItem.data)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, flatCommands, onClose])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  const executeCommand = (cmd) => {
    addRecentAction(cmd.id)
    cmd.action()
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Command Palette Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glass effect container */}
          <div className="relative bg-ops-surface/90 dark:bg-ops-surface/90 light:bg-ops-light-surface/95 border border-ops-border/50 dark:border-ops-border/50 light:border-ops-light-border rounded-2xl shadow-depth-floating backdrop-blur-xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-ops-border/50 dark:border-ops-border/50 light:border-ops-light-border">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-ops-text dark:text-ops-text light:text-ops-light-text placeholder-gray-500 outline-none text-base"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-gray-400 bg-ops-bg/50 dark:bg-ops-bg/50 light:bg-ops-light-bg/50 border border-ops-border/30 dark:border-ops-border/30 light:border-ops-light-border rounded">
                Esc
              </kbd>
            </div>

            {/* Command list */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {flatCommands.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No commands found</p>
                </div>
              ) : (
                <div className="py-2">
                  {flatCommands.map((item, index) => {
                    if (item.type === 'category') {
                      return (
                        <div
                          key={`category-${item.label}`}
                          className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 first:mt-0"
                        >
                          {item.label}
                        </div>
                      )
                    }

                    const cmd = item.data
                    const Icon = ICON_MAP[cmd.icon]
                    const isSelected = index === selectedIndex

                    return (
                      <motion.button
                        key={cmd.id}
                        data-index={index}
                        onClick={() => executeCommand(cmd)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                          ${isSelected
                            ? 'bg-accent-cyan/10 dark:bg-accent-cyan/10 light:bg-accent-cyan/20'
                            : 'hover:bg-ops-hover/50 dark:hover:bg-ops-hover/50 light:hover:bg-ops-light-hover'
                          }
                        `}
                        whileHover={{ x: 4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      >
                        {Icon && (
                          <Icon className={`w-5 h-5 flex-shrink-0 ${
                            isSelected 
                              ? 'text-accent-cyan' 
                              : 'text-gray-400'
                          }`} />
                        )}
                        <span className={`flex-1 text-sm ${
                          isSelected
                            ? 'text-accent-cyan font-medium'
                            : 'text-ops-text dark:text-ops-text light:text-ops-light-text'
                        }`}>
                          {cmd.label}
                        </span>
                        {isSelected && (
                          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 rounded">
                            ↵
                          </kbd>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-ops-border/50 dark:border-ops-border/50 light:border-ops-light-border bg-ops-bg/30 dark:bg-ops-bg/30 light:bg-ops-light-bg/30">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-ops-surface dark:bg-ops-surface light:bg-ops-light-surface border border-ops-border/30 dark:border-ops-border/30 light:border-ops-light-border rounded">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-ops-surface dark:bg-ops-surface light:bg-ops-light-surface border border-ops-border/30 dark:border-ops-border/30 light:border-ops-light-border rounded">↵</kbd>
                  <span>Select</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-ops-surface dark:bg-ops-surface light:bg-ops-light-surface border border-ops-border/30 dark:border-ops-border/30 light:border-ops-light-border rounded">Esc</kbd>
                  <span>Close</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                <kbd className="px-1.5 py-0.5 font-mono bg-ops-surface dark:bg-ops-surface light:bg-ops-light-surface border border-ops-border/30 dark:border-ops-border/30 light:border-ops-light-border rounded">⌘K</kbd>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
