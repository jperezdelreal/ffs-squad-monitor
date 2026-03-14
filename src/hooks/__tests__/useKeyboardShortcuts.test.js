import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  let mockHandlers

  beforeEach(() => {
    mockHandlers = {
      onViewChange: vi.fn(),
      onRefresh: vi.fn(),
      onOpenExport: vi.fn(),
      onToggleShortcuts: vi.fn(),
      shortcutsOpen: false,
      settingsOpen: false,
      notificationsOpen: false,
    }
  })

  it('returns shortcuts list', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(mockHandlers))
    expect(result.current.shortcuts).toBeDefined()
    expect(result.current.shortcuts.length).toBeGreaterThan(0)
  })

  it('handles view navigation keys 1-7', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: '1' })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onViewChange).toHaveBeenCalledWith('activity')
  })

  it('handles r for refresh', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: 'r' })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onRefresh).toHaveBeenCalled()
  })

  it('handles e for export', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: 'e' })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onOpenExport).toHaveBeenCalled()
  })

  it('handles ? to toggle shortcuts', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: '?' })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onToggleShortcuts).toHaveBeenCalled()
  })

  it('handles Escape key', () => {
    mockHandlers.shortcutsOpen = true
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onToggleShortcuts).toHaveBeenCalled()
  })

  it('ignores shortcuts when typing in input', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const input = document.createElement('input')
    document.body.appendChild(input)
    
    const event = new KeyboardEvent('keydown', { key: 'r' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onRefresh).not.toHaveBeenCalled()
    
    document.body.removeChild(input)
  })

  it('ignores shortcuts when modifier keys are pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onRefresh).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when panels are open', () => {
    mockHandlers.settingsOpen = true
    renderHook(() => useKeyboardShortcuts(mockHandlers))
    
    const event = new KeyboardEvent('keydown', { key: 'r' })
    window.dispatchEvent(event)
    
    expect(mockHandlers.onRefresh).not.toHaveBeenCalled()
  })
})
