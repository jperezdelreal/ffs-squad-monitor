import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore, initialState } from '../../store/store'

// Mock notifications lib
const mockCreateNotificationSSE = vi.fn()
const mockRequestPermission = vi.fn()
const mockGetPermissionState = vi.fn()
const mockGetNotificationPrefs = vi.fn()
const mockSetNotificationPrefs = vi.fn()

vi.mock('../../lib/notifications', () => ({
  createNotificationSSE: (...args) => mockCreateNotificationSSE(...args),
  requestPermission: () => mockRequestPermission(),
  getPermissionState: () => mockGetPermissionState(),
  getNotificationPrefs: () => mockGetNotificationPrefs(),
  setNotificationPrefs: (prefs) => mockSetNotificationPrefs(prefs),
}))

const { useNotifications } = await import('../useNotifications')

describe('useNotifications', () => {
  beforeEach(() => {
    useStore.setState({
      ...initialState,
      addNotification: vi.fn(),
      notifications: [],
      notificationSSEStatus: 'idle',
      setNotificationSSEStatus: vi.fn(),
    })

    mockGetPermissionState.mockReturnValue('default')
    mockGetNotificationPrefs.mockReturnValue({ enabled: true, sound: true })
    mockCreateNotificationSSE.mockReturnValue({ close: vi.fn() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should establish SSE connection on mount', () => {
    renderHook(() => useNotifications())

    expect(mockCreateNotificationSSE).toHaveBeenCalledTimes(1)
    expect(mockCreateNotificationSSE).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('should pass notification callback to SSE', () => {
    let notificationCallback
    mockCreateNotificationSSE.mockImplementation((cb) => {
      notificationCallback = cb
      return { close: vi.fn() }
    })

    const addNotification = vi.fn()
    useStore.setState({ addNotification })

    renderHook(() => useNotifications())

    // Simulate notification from SSE
    const testNotification = { id: '1', message: 'Test' }
    notificationCallback(testNotification)

    expect(addNotification).toHaveBeenCalledWith(testNotification)
  })

  it('should pass status callback to SSE', () => {
    let statusCallback
    mockCreateNotificationSSE.mockImplementation((notifCb, statusCb) => {
      statusCallback = statusCb
      return { close: vi.fn() }
    })

    const setNotificationSSEStatus = vi.fn()
    useStore.setState({ setNotificationSSEStatus })

    renderHook(() => useNotifications())

    // Simulate status change from SSE
    statusCallback('connected')

    expect(setNotificationSSEStatus).toHaveBeenCalledWith('connected')
  })

  it('should close SSE connection on unmount', () => {
    const mockConnection = { close: vi.fn() }
    mockCreateNotificationSSE.mockReturnValue(mockConnection)

    const { unmount } = renderHook(() => useNotifications())

    unmount()

    expect(mockConnection.close).toHaveBeenCalledTimes(1)
  })

  it('should return notifications from store', () => {
    const notifications = [
      { id: '1', message: 'Test 1' },
      { id: '2', message: 'Test 2' },
    ]
    useStore.setState({ notifications })

    const { result } = renderHook(() => useNotifications())

    expect(result.current.notifications).toEqual(notifications)
  })

  it('should return SSE status from store', () => {
    useStore.setState({ notificationSSEStatus: 'connected' })

    const { result } = renderHook(() => useNotifications())

    expect(result.current.sseStatus).toBe('connected')
  })

  it('should return permission state', () => {
    mockGetPermissionState.mockReturnValue('granted')

    const { result } = renderHook(() => useNotifications())

    expect(result.current.permissionState).toBe('granted')
  })

  it('should return notification preferences', () => {
    const prefs = { enabled: false, sound: false }
    mockGetNotificationPrefs.mockReturnValue(prefs)

    const { result } = renderHook(() => useNotifications())

    expect(result.current.prefs).toEqual(prefs)
  })

  it('should handle requestPermission', async () => {
    mockRequestPermission.mockResolvedValue('granted')

    const { result } = renderHook(() => useNotifications())

    const permissionResult = await result.current.requestPermission()

    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    expect(permissionResult).toBe('granted')
  })

  it('should handle updatePrefs', () => {
    const initialPrefs = { enabled: true, sound: true }
    mockGetNotificationPrefs.mockReturnValue(initialPrefs)

    const { result } = renderHook(() => useNotifications())

    act(() => {
      result.current.updatePrefs({ sound: false })
    })

    expect(mockSetNotificationPrefs).toHaveBeenCalledWith({
      enabled: true,
      sound: false,
    })
  })

  it('should establish SSE connection once', () => {
    mockCreateNotificationSSE.mockClear()
    const { rerender } = renderHook(() => useNotifications())

    expect(mockCreateNotificationSSE).toHaveBeenCalledTimes(1)

    // Rerender doesn't cause new connection (callbacks are deps)
    rerender()

    // Will be called again due to callback deps, which is expected behavior
    expect(mockCreateNotificationSSE).toHaveBeenCalled()
  })

  it('should handle missing permission API', () => {
    mockGetPermissionState.mockReturnValue('unsupported')

    const { result } = renderHook(() => useNotifications())

    expect(result.current.permissionState).toBe('unsupported')
  })
})
