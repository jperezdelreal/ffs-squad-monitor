import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStore, initialState } from '../../store/store'
import { usePolling } from '../usePolling'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useStore.setState({
      ...initialState,
      refreshAll: vi.fn(),
      lastUpdate: Date.now(),
      isConnected: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should call refreshAll immediately on mount', () => {
    const refreshAll = vi.fn()
    useStore.setState({ refreshAll })

    renderHook(() => usePolling())

    expect(refreshAll).toHaveBeenCalledTimes(1)
  })

  it('should call refreshAll on interval', async () => {
    const refreshAll = vi.fn()
    useStore.setState({ refreshAll })

    renderHook(() => usePolling())

    expect(refreshAll).toHaveBeenCalledTimes(1)

    // Advance 60 seconds
    vi.advanceTimersByTime(60000)
    expect(refreshAll).toHaveBeenCalledTimes(2)

    // Advance another 60 seconds
    vi.advanceTimersByTime(60000)
    expect(refreshAll).toHaveBeenCalledTimes(3)
  })

  it('should return lastUpdate and isConnected from store', () => {
    const now = Date.now()
    useStore.setState({ 
      lastUpdate: now, 
      isConnected: true,
      refreshAll: vi.fn()
    })

    const { result } = renderHook(() => usePolling())

    expect(result.current.lastUpdate).toBe(now)
    expect(result.current.isConnected).toBe(true)
  })

  it('should cleanup interval on unmount', () => {
    const refreshAll = vi.fn()
    useStore.setState({ refreshAll })

    const { unmount } = renderHook(() => usePolling())

    expect(refreshAll).toHaveBeenCalledTimes(1)

    unmount()

    // Advance time after unmount - should not call refreshAll again
    vi.advanceTimersByTime(60000)
    expect(refreshAll).toHaveBeenCalledTimes(1)
  })

  it('should handle store state changes', () => {
    const refreshAll = vi.fn()
    useStore.setState({ refreshAll, lastUpdate: 1000, isConnected: false })

    const { result, rerender } = renderHook(() => usePolling())

    expect(result.current.lastUpdate).toBe(1000)
    expect(result.current.isConnected).toBe(false)

    // Update store state
    useStore.setState({ lastUpdate: 2000, isConnected: true })
    rerender()

    expect(result.current.lastUpdate).toBe(2000)
    expect(result.current.isConnected).toBe(true)
  })
})
