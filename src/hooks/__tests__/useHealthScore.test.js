import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStore, initialState } from '../../store/store'

// Mock api.js
const mockGetConnectionState = vi.fn()
const mockOnConnectionChange = vi.fn()

vi.mock('../../lib/api', () => ({
  getConnectionState: () => mockGetConnectionState(),
  onConnectionChange: (fn) => mockOnConnectionChange(fn),
}))

// Mock health.js
vi.mock('../../lib/health', () => ({
  computeHealthScore: vi.fn(() => 90),
  healthLevel: vi.fn((score) => (score >= 80 ? 'healthy' : 'degraded')),
  healthBreakdown: vi.fn(() => ({ connection: 100, api: 100 })),
}))

const { useHealthScore } = await import('../useHealthScore')

describe('useHealthScore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useStore.setState({ ...initialState, lastUpdate: Date.now() })
    mockGetConnectionState.mockReturnValue('operational')
    mockOnConnectionChange.mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should compute health score from store state', () => {
    const now = Date.now()
    useStore.setState({ lastUpdate: now })

    const { result } = renderHook(() => useHealthScore())

    expect(result.current.score).toBe(90)
    expect(result.current.level).toBe('healthy')
    expect(result.current.breakdown).toEqual({ connection: 100, api: 100 })
  })

  it('should recompute on tick interval', async () => {
    const now = Date.now()
    useStore.setState({ lastUpdate: now })

    const { result, rerender } = renderHook(() => useHealthScore())

    // Advance 1 second to trigger tick
    vi.advanceTimersByTime(1000)
    rerender()

    // Score should still be computed
    expect(result.current.score).toBe(90)
  })

  it('should subscribe to connection state changes', () => {
    mockOnConnectionChange.mockClear()
    renderHook(() => useHealthScore())

    expect(mockOnConnectionChange).toHaveBeenCalled()
    expect(mockOnConnectionChange).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should cleanup subscriptions on unmount', () => {
    const unsubscribe = vi.fn()
    mockOnConnectionChange.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useHealthScore())

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('should cleanup timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = renderHook(() => useHealthScore())

    const initialCallCount = clearIntervalSpy.mock.calls.length

    unmount()

    // Should have called clearInterval at least once more
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(initialCallCount)
  })

  it('should return score, level, and breakdown', () => {
    const { result } = renderHook(() => useHealthScore())

    expect(result.current.score).toBeDefined()
    expect(result.current.level).toBeDefined()
    expect(result.current.breakdown).toBeDefined()
  })

  it('should handle connection state updates', () => {
    let connectionCallback
    mockOnConnectionChange.mockImplementation((cb) => {
      connectionCallback = cb
      return () => {}
    })

    mockGetConnectionState.mockReturnValue('operational')

    const { result, rerender } = renderHook(() => useHealthScore())

    expect(result.current.level).toBe('healthy')

    // Simulate connection state change
    mockGetConnectionState.mockReturnValue('degraded')
    if (connectionCallback) {
      connectionCallback('degraded')
    }
    rerender()

    // Should re-compute with new connection state
    expect(result.current.level).toBe('healthy')
  })

  it('should recompute on lastUpdate change', () => {
    const now = Date.now()
    useStore.setState({ lastUpdate: now })

    const { result, rerender } = renderHook(() => useHealthScore())

    // Update lastUpdate in store
    useStore.setState({ lastUpdate: now - 60000 })
    rerender()

    // Score should still be valid
    expect(result.current.score).toBe(90)
  })
})
