import { useEffect, useCallback } from 'react'
import { useStore } from '../store/store'
import {
  createNotificationSSE,
  requestPermission,
  getPermissionState,
  getNotificationPrefs,
  setNotificationPrefs,
} from '../lib/notifications'

/**
 * React hook for browser notifications via SSE.
 * Connects to the alerts SSE channel, manages permission state,
 * and feeds notifications into the Zustand store.
 */
export function useNotifications() {
  const addNotification = useStore(s => s.addNotification)
  const notifications = useStore(s => s.notifications)
  const sseStatus = useStore(s => s.notificationSSEStatus)
  const setSseStatus = useStore(s => s.setNotificationSSEStatus)

  useEffect(() => {
    const connection = createNotificationSSE(
      (notification) => {
        addNotification(notification)
      },
      (status) => {
        setSseStatus(status)
      },
    )

    return () => connection.close()
  }, [addNotification, setSseStatus])

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission()
    return result
  }, [])

  const permissionState = getPermissionState()
  const prefs = getNotificationPrefs()

  const updatePrefs = useCallback((newPrefs) => {
    setNotificationPrefs({ ...prefs, ...newPrefs })
  }, [prefs])

  return {
    notifications,
    sseStatus,
    permissionState,
    prefs,
    requestPermission: handleRequestPermission,
    updatePrefs,
  }
}
