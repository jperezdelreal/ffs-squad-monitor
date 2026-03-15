import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSwipeGesture } from '../useSwipeGesture'

describe('useSwipeGesture', () => {
  let onSwipeLeft
  let onSwipeRight

  beforeEach(() => {
    onSwipeLeft = vi.fn()
    onSwipeRight = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createTouchEvent = (type, clientX, clientY) => {
    return new TouchEvent(type, {
      touches: [{ clientX, clientY }],
      bubbles: true,
      cancelable: true,
    })
  }

  it('should detect swipe right', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    // Swipe from 100 to 200 (right)
    document.dispatchEvent(createTouchEvent('touchstart', 100, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 200, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('should detect swipe left', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    // Swipe from 200 to 100 (left)
    document.dispatchEvent(createTouchEvent('touchstart', 200, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 100, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('should not trigger swipe if delta is below threshold', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold: 100 }))

    // Small swipe (only 40px)
    document.dispatchEvent(createTouchEvent('touchstart', 100, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 140, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('should not trigger swipe if vertical movement is dominant', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold: 50 }))

    // More vertical than horizontal
    document.dispatchEvent(createTouchEvent('touchstart', 100, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 130, 200))
    document.dispatchEvent(new TouchEvent('touchend'))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('should not trigger if disabled', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, enabled: false }))

    document.dispatchEvent(createTouchEvent('touchstart', 100, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 200, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function))
  })

  it('should handle missing touch coordinates gracefully', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }))

    // Missing touchmove event
    document.dispatchEvent(createTouchEvent('touchstart', 100, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('should use custom threshold', () => {
    renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold: 200 }))

    // Swipe 150px (below custom threshold)
    document.dispatchEvent(createTouchEvent('touchstart', 100, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 250, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    // Should still trigger because 150 < 200
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('should handle optional callbacks', () => {
    // Only provide onSwipeRight
    renderHook(() => useSwipeGesture({ onSwipeRight, threshold: 50 }))

    // Swipe left (no callback provided)
    document.dispatchEvent(createTouchEvent('touchstart', 200, 100))
    document.dispatchEvent(createTouchEvent('touchmove', 100, 100))
    document.dispatchEvent(new TouchEvent('touchend'))

    // Should not throw, just do nothing
    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
