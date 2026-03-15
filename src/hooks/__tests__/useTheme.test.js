import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../useTheme'

describe('useTheme', () => {
  let matchMediaListeners
  let mockMatchMedia

  beforeEach(() => {
    matchMediaListeners = []
    mockMatchMedia = {
      matches: true,
      addEventListener: vi.fn((_, handler) => matchMediaListeners.push(handler)),
      removeEventListener: vi.fn((_, handler) => {
        matchMediaListeners = matchMediaListeners.filter(h => h !== handler)
      }),
    }
    window.matchMedia = vi.fn(() => mockMatchMedia)
    localStorage.clear()
    document.documentElement.classList.remove('dark', 'light')
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light')
  })

  it('detects system dark preference', () => {
    mockMatchMedia.matches = true
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('defaults to dark when no stored preference', () => {
    mockMatchMedia.matches = false
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('reads theme from localStorage', () => {
    localStorage.setItem('ffs-squad-monitor-theme', 'light')
    mockMatchMedia.matches = true
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('persists theme to localStorage on change', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    expect(localStorage.getItem('ffs-squad-monitor-theme')).toBe('light')
  })

  it('toggles between dark and light', () => {
    mockMatchMedia.matches = true
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme sets specific theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    expect(result.current.theme).toBe('light')
    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
  })

  it('responds to system preference changes when no stored value', () => {
    localStorage.clear()
    mockMatchMedia.matches = true
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => {
      matchMediaListeners.forEach(fn => fn({ matches: false }))
    })
    expect(result.current.theme).toBe('light')
  })

  it('ignores invalid values in setTheme', () => {
    const { result } = renderHook(() => useTheme())
    const before = result.current.theme
    act(() => result.current.setTheme('invalid'))
    expect(result.current.theme).toBe(before)
  })
})
