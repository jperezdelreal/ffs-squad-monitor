import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getNotificationPrefs,
  setNotificationPrefs,
  getPermissionState,
  requestPermission,
  isDuplicate,
  showBrowserNotification,
  clearDedupCache,
} from '../notifications.js'

describe('getNotificationPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when no prefs stored', () => {
    const prefs = getNotificationPrefs()
    expect(prefs).toEqual({ enabled: true, sound: false })
  })

  it('returns stored prefs', () => {
    localStorage.setItem('ffs-notification-prefs', JSON.stringify({ enabled: false, sound: true }))
    const prefs = getNotificationPrefs()
    expect(prefs).toEqual({ enabled: false, sound: true })
  })

  it('returns defaults on invalid JSON', () => {
    localStorage.setItem('ffs-notification-prefs', 'not-json')
    const prefs = getNotificationPrefs()
    expect(prefs).toEqual({ enabled: true, sound: false })
  })
})

describe('setNotificationPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores prefs to localStorage', () => {
    setNotificationPrefs({ enabled: false, sound: true })
    const stored = JSON.parse(localStorage.getItem('ffs-notification-prefs'))
    expect(stored).toEqual({ enabled: false, sound: true })
  })
})

describe('getPermissionState', () => {
  afterEach(() => {
    delete globalThis.Notification
  })

  it('returns unsupported when Notification is undefined', () => {
    const orig = globalThis.Notification
    delete globalThis.Notification
    expect(getPermissionState()).toBe('unsupported')
    if (orig) globalThis.Notification = orig
  })

  it('returns current permission state', () => {
    globalThis.Notification = { permission: 'granted' }
    expect(getPermissionState()).toBe('granted')
  })
})

describe('requestPermission', () => {
  afterEach(() => {
    delete globalThis.Notification
  })

  it('returns unsupported when Notification is undefined', async () => {
    delete globalThis.Notification
    expect(await requestPermission()).toBe('unsupported')
  })

  it('returns granted immediately if already granted', async () => {
    globalThis.Notification = { permission: 'granted', requestPermission: vi.fn() }
    expect(await requestPermission()).toBe('granted')
  })

  it('returns denied immediately if already denied', async () => {
    globalThis.Notification = { permission: 'denied', requestPermission: vi.fn() }
    expect(await requestPermission()).toBe('denied')
  })

  it('calls Notification.requestPermission for default state', async () => {
    globalThis.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    }
    expect(await requestPermission()).toBe('granted')
    expect(Notification.requestPermission).toHaveBeenCalledOnce()
  })
})

describe('isDuplicate / dedup', () => {
  beforeEach(() => {
    clearDedupCache()
  })

  it('returns false for first occurrence', () => {
    const notif = { type: 'test', body: 'hello' }
    expect(isDuplicate(notif)).toBe(false)
  })

  it('returns true for duplicate within window', () => {
    const notif = { type: 'test', body: 'hello' }
    isDuplicate(notif) // first
    expect(isDuplicate(notif)).toBe(true) // duplicate
  })

  it('returns false for different notifications', () => {
    isDuplicate({ type: 'a', body: 'hello' })
    expect(isDuplicate({ type: 'b', body: 'hello' })).toBe(false)
    expect(isDuplicate({ type: 'a', body: 'world' })).toBe(false)
  })
})

describe('showBrowserNotification', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    delete globalThis.Notification
  })

  it('returns null when Notification is undefined', () => {
    delete globalThis.Notification
    const result = showBrowserNotification({
      type: 'test',
      severity: 'info',
      title: 'Test',
      body: 'Test body',
      timestamp: new Date().toISOString(),
    })
    expect(result).toBeNull()
  })

  it('returns null when permission not granted', () => {
    globalThis.Notification = vi.fn()
    globalThis.Notification.permission = 'denied'
    const result = showBrowserNotification({
      type: 'test',
      severity: 'info',
      title: 'Test',
      body: 'Test body',
      timestamp: new Date().toISOString(),
    })
    expect(result).toBeNull()
  })

  it('returns null when notifications disabled in prefs', () => {
    localStorage.setItem('ffs-notification-prefs', JSON.stringify({ enabled: false, sound: false }))
    globalThis.Notification = vi.fn(() => ({}))
    globalThis.Notification.permission = 'granted'
    const result = showBrowserNotification({
      type: 'test',
      severity: 'info',
      title: 'Test',
      body: 'Test body',
      timestamp: new Date().toISOString(),
    })
    expect(result).toBeNull()
  })

  it('creates native notification when permission granted and prefs enabled', () => {
    localStorage.setItem('ffs-notification-prefs', JSON.stringify({ enabled: true, sound: false }))
    const mockNotif = {}
    const MockNotification = vi.fn(function() { Object.assign(this, mockNotif) })
    MockNotification.permission = 'granted'
    globalThis.Notification = MockNotification

    const result = showBrowserNotification({
      type: 'test',
      severity: 'critical',
      title: 'Alert',
      body: 'Critical alert',
      timestamp: new Date().toISOString(),
    })
    expect(result).not.toBeNull()
    expect(MockNotification).toHaveBeenCalledWith(
      expect.stringContaining('Alert'),
      expect.objectContaining({
        body: 'Critical alert',
        tag: 'test',
        requireInteraction: true,
      })
    )
  })

  it('sets onclick handler when link is provided', () => {
    localStorage.setItem('ffs-notification-prefs', JSON.stringify({ enabled: true, sound: false }))
    const MockNotification = vi.fn(function() {})
    MockNotification.permission = 'granted'
    globalThis.Notification = MockNotification

    showBrowserNotification({
      type: 'test',
      severity: 'info',
      title: 'Test',
      body: 'Test',
      timestamp: new Date().toISOString(),
      link: 'https://example.com',
    })
    // The onclick is set on the instance created via new
    const instance = MockNotification.mock.instances[0]
    expect(instance.onclick).toBeDefined()
  })
})
