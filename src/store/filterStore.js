import { create } from 'zustand'
import Fuse from 'fuse.js'

const FILTER_PRESETS_KEY = 'ffs-monitor-filter-presets'
const ACTIVE_FILTERS_KEY = 'ffs-monitor-active-filters'

const DEFAULT_FILTERS = {
  agent: 'all',
  level: 'all',
  type: 'all',
  repo: 'all',
  timeRange: 'all',
  customStart: null,
  customEnd: null,
  keyword: '',
  fuzzyEnabled: true,
  booleanQuery: '',
  activeQuickFilters: [],
}

export const QUICK_FILTERS = [
  { id: 'errors', label: 'Errors Only', icon: '⚠️', filters: { level: 'error' } },
  { id: 'warnings', label: 'Warnings', icon: '⚡', filters: { level: 'warn' } },
  { id: 'today', label: 'Today', icon: '📅', filters: { timeRange: 'today' } },
  { id: 'last-hour', label: 'Last Hour', icon: '⏰', filters: { timeRange: '1h' } },
]

function getTimeRangeFilter(timeRange, customStart, customEnd) {
  const now = new Date()
  switch (timeRange) {
    case '1h':
      return { from: new Date(now - 60 * 60 * 1000) }
    case 'today':
      return { from: new Date(now.setHours(0, 0, 0, 0)) }
    case 'week':
      return { from: new Date(now - 7 * 24 * 60 * 60 * 1000) }
    case 'custom':
      return { from: customStart, to: customEnd }
    default:
      return null
  }
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(FILTER_PRESETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadActiveFilters() {
  try {
    const raw = localStorage.getItem(ACTIVE_FILTERS_KEY)
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : { ...DEFAULT_FILTERS }
  } catch {
    return { ...DEFAULT_FILTERS }
  }
}

function persistPresets(presets) {
  try {
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets))
  } catch {}
}

function persistActiveFilters(filters) {
  try {
    localStorage.setItem(ACTIVE_FILTERS_KEY, JSON.stringify(filters))
  } catch {}
}

export const useFilterStore = create((set, get) => ({
  filters: loadActiveFilters(),
  presets: loadPresets(),
  fuseInstances: {},
  
  setFilter: (field, value) => set((state) => {
    const updated = { ...state.filters, [field]: value }
    persistActiveFilters(updated)
    return { filters: updated }
  }),
  
  setFilters: (patch) => set((state) => {
    const updated = { ...state.filters, ...patch }
    persistActiveFilters(updated)
    return { filters: updated }
  }),
  
  resetFilters: () => set(() => {
    const reset = { ...DEFAULT_FILTERS }
    persistActiveFilters(reset)
    return { filters: reset }
  }),
  
  toggleQuickFilter: (filterId) => set((state) => {
    const quickFilter = QUICK_FILTERS.find(qf => qf.id === filterId)
    if (!quickFilter) return state
    
    const isActive = state.filters.activeQuickFilters.includes(filterId)
    let updated = { ...state.filters }
    
    if (isActive) {
      updated.activeQuickFilters = state.filters.activeQuickFilters.filter(id => id !== filterId)
      Object.keys(quickFilter.filters).forEach(key => {
        updated[key] = DEFAULT_FILTERS[key]
      })
    } else {
      updated.activeQuickFilters = [...state.filters.activeQuickFilters, filterId]
      updated = { ...updated, ...quickFilter.filters }
    }
    
    persistActiveFilters(updated)
    return { filters: updated }
  }),
  
  savePreset: (name) => set((state) => {
    const newPreset = {
      id: Date.now().toString(),
      name,
      filters: { ...state.filters },
      createdAt: new Date().toISOString(),
    }
    const updated = [...state.presets, newPreset]
    persistPresets(updated)
    return { presets: updated }
  }),
  
  loadPreset: (presetId) => set((state) => {
    const preset = state.presets.find(p => p.id === presetId)
    if (!preset) return state
    
    const updated = { ...preset.filters }
    persistActiveFilters(updated)
    return { filters: updated }
  }),
  
  deletePreset: (presetId) => set((state) => {
    const updated = state.presets.filter(p => p.id !== presetId)
    persistPresets(updated)
    return { presets: updated }
  }),
  
  renamePreset: (presetId, newName) => set((state) => {
    const updated = state.presets.map(p =>
      p.id === presetId ? { ...p, name: newName } : p
    )
    persistPresets(updated)
    return { presets: updated }
  }),
  
  setupFuseInstance: (key, data, options) => set((state) => {
    const fuse = new Fuse(data, options)
    return { fuseInstances: { ...state.fuseInstances, [key]: fuse } }
  }),
  
  applyFilters: (data, dataType = 'logs') => {
    const state = get()
    const { filters, fuseInstances } = state
    
    let filtered = [...data]
    
    const timeFilter = getTimeRangeFilter(filters.timeRange, filters.customStart, filters.customEnd)
    if (timeFilter) {
      filtered = filtered.filter(item => {
        const timestamp = new Date(item.timestamp || item.created_at || item.createdAt)
        if (timeFilter.from && timestamp < timeFilter.from) return false
        if (timeFilter.to && timestamp > timeFilter.to) return false
        return true
      })
    }
    
    if (filters.agent !== 'all') {
      filtered = filtered.filter(item => 
        (item.agent || item.assignee || item.author || '').toLowerCase().includes(filters.agent.toLowerCase())
      )
    }
    
    if (filters.level !== 'all') {
      filtered = filtered.filter(item => 
        (item.level || item.severity || '').toLowerCase() === filters.level.toLowerCase()
      )
    }
    
    if (filters.type !== 'all') {
      filtered = filtered.filter(item => 
        (item.type || item.event_type || '').toLowerCase() === filters.type.toLowerCase()
      )
    }
    
    if (filters.repo !== 'all') {
      filtered = filtered.filter(item => 
        (item.repo || item.repository || '').toLowerCase().includes(filters.repo.toLowerCase())
      )
    }
    
    if (filters.keyword.trim()) {
      if (filters.fuzzyEnabled && fuseInstances[dataType]) {
        const results = fuseInstances[dataType].search(filters.keyword)
        const resultIds = new Set(results.map(r => r.item.id || r.item.number))
        filtered = filtered.filter(item => resultIds.has(item.id || item.number))
      } else {
        const keyword = filters.keyword.toLowerCase()
        filtered = filtered.filter(item => {
          const searchable = [
            item.message,
            item.title,
            item.body,
            item.description,
          ].filter(Boolean).join(' ').toLowerCase()
          return searchable.includes(keyword)
        })
      }
    }
    
    return filtered
  },
  
  getActiveFilterCount: () => {
    const { filters } = get()
    let count = 0
    
    if (filters.agent !== 'all') count++
    if (filters.level !== 'all') count++
    if (filters.type !== 'all') count++
    if (filters.repo !== 'all') count++
    if (filters.timeRange !== 'all') count++
    if (filters.keyword.trim()) count++
    if (filters.booleanQuery.trim()) count++
    if (filters.activeQuickFilters.length > 0) count += filters.activeQuickFilters.length
    
    return count
  },
  
  exportData: (data, format = 'json') => {
    const state = get()
    const filtered = state.applyFilters(data)
    
    if (format === 'json') {
      const json = JSON.stringify(filtered, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `filtered-data-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else if (format === 'csv') {
      if (filtered.length === 0) return
      
      const headers = Object.keys(filtered[0])
      const csvRows = [
        headers.join(','),
        ...filtered.map(item =>
          headers.map(header => {
            const value = item[header]
            const escaped = String(value || '').replace(/"/g, '""')
            return escaped.includes(',') ? `"${escaped}"` : escaped
          }).join(',')
        )
      ]
      
      const csv = csvRows.join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `filtered-data-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  },
}))

export { DEFAULT_FILTERS }