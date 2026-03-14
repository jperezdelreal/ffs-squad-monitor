import { create } from 'zustand'
import { fetchConfig } from '../services/config'

const SETTINGS_KEY = 'ffs-monitor-settings'

const DEFAULT_SETTINGS = {
  // Per-notification-type toggles
  alertTypes: {
    agentBlocked: true,
    heartbeatStale: true,
    buildFailed: true,
    rateLimitWarning: true,
    issueSpike: false,
    sprintMilestone: false,
  },
  // Sound & desktop
  soundEnabled: false,
  desktopEnabled: true,
  // Thresholds
  stalenessThresholdMin: 5,
  rateLimitThreshold: 100,
  issueSpikeCount: 3,
  issueSpikeWindowMin: 5,
  // Display
  pollingInterval: 60,
  autoRefresh: true,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function persistSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // localStorage may be unavailable
  }
}

export const initialState = {
  // Heartbeat
  heartbeatData: null,
  isConnected: false,
  lastUpdate: null,
  error: null,

  // Events (ActivityFeed)
  events: [],
  eventsLoading: true,
  eventsError: null,

  // Issues (PipelineVisualizer + TeamBoard)
  issues: [],
  issuesLoading: true,
  issuesError: null,

  // Usage (CostTracker)
  usage: null,
  usageLoading: true,
  usageError: null,

  // Agents (TeamBoard — derived from issues + config)
  agents: [],
  agentsLoading: true,
  agentsError: null,

  // Notifications (browser alerts via SSE)
  notifications: [],
  unreadCount: 0,
  notificationSSEStatus: 'disconnected',

  // UI panels
  showNotificationPanel: false,
  showSettingsPanel: false,
  showShortcutsPanel: false,

  // Settings (hydrated from localStorage)
  settings: loadSettings(),

  // SSE connection status
  sseStatus: 'disconnected',
}

export const useStore = create((set, get) => ({
  ...initialState,

  setHeartbeatData: (data) => set({
    heartbeatData: data,
    isConnected: true,
    lastUpdate: Date.now(),
    error: null,
  }),

  setError: (error) => set({
    error,
    isConnected: false,
  }),

  setLastUpdate: (timestamp) => set({ lastUpdate: timestamp }),

  addNotification: (notification) => set((state) => {
    const enriched = {
      ...notification,
      id: notification.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false,
    }
    const updated = [enriched, ...state.notifications].slice(0, 50)
    return {
      notifications: updated,
      unreadCount: state.unreadCount + 1,
    }
  }),

  removeNotification: (id) => set((state) => {
    const removed = state.notifications.find(n => n.id === id)
    return {
      notifications: state.notifications.filter(n => n.id !== id),
      unreadCount: removed && !removed.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }
  }),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  toggleNotificationPanel: () => set((state) => ({
    showNotificationPanel: !state.showNotificationPanel,
    showSettingsPanel: false,
    showShortcutsPanel: false,
  })),

  toggleSettingsPanel: () => set((state) => ({
    showSettingsPanel: !state.showSettingsPanel,
    showNotificationPanel: false,
    showShortcutsPanel: false,
  })),

  toggleShortcutsPanel: () => set((state) => ({
    showShortcutsPanel: !state.showShortcutsPanel,
    showNotificationPanel: false,
    showSettingsPanel: false,
  })),

  closeAllPanels: () => set({ showNotificationPanel: false, showSettingsPanel: false, showShortcutsPanel: false }),

  updateSettings: (patch) => set((state) => {
    const updated = { ...state.settings, ...patch }
    persistSettings(updated)
    return { settings: updated }
  }),

  updateAlertType: (key, value) => set((state) => {
    const updated = {
      ...state.settings,
      alertTypes: { ...state.settings.alertTypes, [key]: value },
    }
    persistSettings(updated)
    return { settings: updated }
  }),

  setNotificationSSEStatus: (status) => set({ notificationSSEStatus: status }),

  setSseStatus: (status) => set({ sseStatus: status }),

  handleSSEEvent: (channel, eventType, data) => {
    const handlers = {
      'heartbeat:update': () => set({
        heartbeatData: data,
        isConnected: true,
        lastUpdate: Date.now(),
        error: null,
      }),
      'events:new': () => set((state) => ({
        events: [data, ...state.events].slice(0, 500),
        eventsLoading: false,
        eventsError: null,
      })),
      'events:snapshot': () => set({
        events: data,
        eventsLoading: false,
        eventsError: null,
      }),
      'issues:update': () => {
        set({
          issues: data.snapshot || data,
          issuesLoading: false,
          issuesError: null,
        })
        get().fetchAgents()
      },
      'usage:update': () => set({
        usage: data,
        usageLoading: false,
        usageError: null,
      }),
    }

    const key = `${channel}:${eventType.split(':').pop()}`
    const fullKey = eventType
    const handler = handlers[fullKey] || handlers[key]
    if (handler) handler()
  },

  fetchHeartbeat: async () => {
    try {
      const response = await fetch('/api/heartbeat')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      set({ heartbeatData: data, isConnected: true, lastUpdate: Date.now(), error: null })
    } catch (error) {
      console.error('Failed to fetch heartbeat:', error)
      set({ error: error.message, isConnected: false })
    }
  },

  fetchEvents: async () => {
    set({ eventsLoading: true, eventsError: null })
    try {
      const response = await fetch('/api/events')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      set({ events: data, eventsLoading: false })
    } catch (error) {
      console.error('Failed to fetch events:', error)
      set({ eventsLoading: false, eventsError: 'Failed to fetch activity data' })
    }
  },

  fetchIssues: async () => {
    set({ issuesLoading: true, issuesError: null })
    try {
      const response = await fetch('/api/issues?state=all')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      set({ issues: data, issuesLoading: false })
    } catch (error) {
      console.error('Failed to fetch issues:', error)
      set({ issuesLoading: false, issuesError: 'Failed to fetch issues data' })
    }
  },

  fetchUsage: async () => {
    set({ usageLoading: true, usageError: null })
    try {
      const response = await fetch('/api/usage')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      set({ usage: data, usageLoading: false })
    } catch (error) {
      console.error('Failed to fetch usage:', error)
      set({ usageLoading: false, usageError: 'Cost data not available' })
    }
  },

  fetchAgents: async () => {
    set({ agentsLoading: true, agentsError: null })
    try {
      const config = await fetchConfig()
      const { issues } = get()

      const agentEntries = Object.entries(config.agents).map(([id, meta]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        emoji: meta.emoji,
        role: meta.role,
        status: 'idle',
        currentTask: null,
        taskCount: 0,
      }))

      const agentMap = new Map()
      issues.forEach(issue => {
        if (issue.state === 'open') {
          issue.labels?.forEach(label => {
            const match = typeof label === 'string' ? label.match(/^squad:(.+)$/) : null
            if (match) {
              const agentId = match[1].toLowerCase()
              if (!agentMap.has(agentId)) agentMap.set(agentId, [])
              agentMap.get(agentId).push({
                number: issue.number,
                title: issue.title,
                repo: issue.repoLabel || issue.repo,
                url: issue.url,
              })
            }
          })
        }
      })

      const agents = agentEntries.map(agent => {
        const tasks = agentMap.get(agent.id) || []
        return {
          ...agent,
          status: tasks.length > 0 ? 'active' : 'idle',
          currentTask: tasks.length > 0 ? tasks[0] : null,
          taskCount: tasks.length,
        }
      })

      set({ agents, agentsLoading: false })
    } catch (error) {
      console.error('Failed to compute agents:', error)
      set({ agentsLoading: false, agentsError: 'Failed to fetch team data' })
    }
  },

  refreshAll: async () => {
    const { fetchHeartbeat, fetchEvents, fetchIssues, fetchUsage, fetchAgents } = get()
    await Promise.allSettled([
      fetchHeartbeat(),
      fetchEvents(),
      fetchIssues(),
      fetchUsage(),
    ])
    // Agents are derived from issues + config, so fetch after issues resolve
    await fetchAgents()
  },
}))
