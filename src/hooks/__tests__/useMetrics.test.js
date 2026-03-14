import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMetrics } from '../../hooks/useMetrics'

describe('useMetrics', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('returns loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { result } = renderHook(() => useMetrics('issues', '7d'))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('fetches data for the given channel', async () => {
    const mockData = [{ timestamp: '2026-03-10T00:00:00Z', channel: 'issues', data: { total: 10 } }]
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, json: () => Promise.resolve({ data: mockData }),
    }))
    const { result } = renderHook(() => useMetrics('issues', '7d'))
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('sets error on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useMetrics('issues', '7d'))
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.error).toBe('Network error')
  })

  it('sets error on non-ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useMetrics('agents', '30d'))
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.error).toBe('HTTP 500')
  })

  it('refetch re-fetches data', async () => {
    let callCount = 0
    global.fetch = vi.fn(() => {
      callCount++
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: callCount }] }) })
    })
    const { result } = renderHook(() => useMetrics('issues', '7d'))
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    await act(async () => { await result.current.refetch() })
    expect(callCount).toBeGreaterThanOrEqual(2)
  })

  it('uses correct interval for 30d time range', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }))
    renderHook(() => useMetrics('issues', '30d'))
    await waitFor(() => {
      const url = global.fetch.mock.calls[0][0]
      expect(url).toContain('interval=6h')
    })
  })
})
