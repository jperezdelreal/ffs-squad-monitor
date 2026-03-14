/**
 * Client-side notification service.
 * Subscribes to SSE alerts channel, requests browser notification permission,
 * shows native notifications, and deduplicates within a 60s window.
 */

const DEDUP_WINDOW_MS = 60_000
const PREFS_KEY = 'ffs-notification-prefs'
const SSE_CHANNELS = 'alerts'

// Track recent notification keys for deduplication
const recentNotifications = new Map()

/**
 * Get user notification preferences from localStorage.
 */
export function getNotificationPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { enabled: true, sound: false }
    return JSON.parse(raw)
  } catch {
    return { enabled: true, sound: false }
  }
}

/**
 * Save user notification preferences to localStorage.
 */
export function setNotificationPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage might be unavailable
  }
}

/**
 * Get current browser notification permission state.
 * Returns 'granted', 'denied', 'default', or 'unsupported'.
 */
export function getPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Request browser notification permission.
 * Returns the resulting permission state.
 */
export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

/**
 * Check if a notification is a duplicate within the dedup window.
 */
export function isDuplicate(notification) {
  const key = `${notification.type}:${notification.body}`
  const lastSeen = recentNotifications.get(key)
  const now = Date.now()

  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true
  }

  recentNotifications.set(key, now)

  // Clean up old entries
  for (const [k, time] of recentNotifications) {
    if (now - time > DEDUP_WINDOW_MS) {
      recentNotifications.delete(k)
    }
  }

  return false
}

/**
 * Severity icon mapping for native notifications.
 */
const SEVERITY_ICONS = {
  critical: '\u{1F534}',
  warning: '\u{26A0}\u{FE0F}',
  info: '\u{2139}\u{FE0F}',
  success: '\u{2705}',
}

/**
 * Show a native browser notification.
 */
export function showBrowserNotification(notification) {
  if (typeof Notification === 'undefined') return null
  if (Notification.permission !== 'granted') return null

  const prefs = getNotificationPrefs()
  if (!prefs.enabled) return null

  const icon = SEVERITY_ICONS[notification.severity] || ''
  const title = `${icon} ${notification.title}`

  try {
    const native = new Notification(title, {
      body: notification.body,
      tag: notification.type,
      timestamp: new Date(notification.timestamp).getTime(),
      requireInteraction: notification.severity === 'critical',
    })

    if (notification.link) {
      native.onclick = () => {
        window.open(notification.link, '_blank')
        native.close()
      }
    }

    return native
  } catch {
    return null
  }
}

/**
 * Create an SSE connection for the alerts channel.
 * Returns an object with { eventSource, close } for lifecycle management.
 *
 * @param {Function} onNotification - Called with each notification object
 * @param {Function} onConnectionChange - Called with 'connected' | 'disconnected' | 'error'
 */
export function createNotificationSSE(onNotification, onConnectionChange) {
  let eventSource = null
  let reconnectTimer = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 10

  function connect() {
    try {
      eventSource = new EventSource(`/api/sse?channels=${SSE_CHANNELS}`)
    } catch {
      onConnectionChange?.('error')
      scheduleReconnect()
      return
    }

    eventSource.addEventListener('connected', () => {
      reconnectAttempts = 0
      onConnectionChange?.('connected')
    })

    eventSource.addEventListener('alerts:new', (event) => {
      try {
        const sseEvent = JSON.parse(event.data)
        const notification = sseEvent.data

        if (isDuplicate(notification)) return

        onNotification?.(notification)
        showBrowserNotification(notification)
      } catch {
        // Malformed event data
      }
    })

    eventSource.onerror = () => {
      onConnectionChange?.('error')
      eventSource?.close()
      eventSource = null
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onConnectionChange?.('disconnected')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30_000)
    reconnectAttempts++
    reconnectTimer = setTimeout(connect, delay)
  }

  function close() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    reconnectAttempts = 0
    onConnectionChange?.('disconnected')
  }

  // Start connection
  connect()

  return { close }
}

/**
 * Clear the dedup cache. Exposed for testing.
 */
export function clearDedupCache() {
  recentNotifications.clear()
}
