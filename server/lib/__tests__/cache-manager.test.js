import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cacheManager } from '../cache-manager.js'
import { eventBus } from '../event-bus.js'

describe('CacheManager', () => {
  beforeEach(() => {
    cacheManager.clear()
    cacheManager.resetMetrics()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('get()', () => {
    it('should execute fetcher on cache miss', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      const result = await cacheManager.get('key1', 'warm', fetcher)

      expect(result).toEqual({ data: 'test' })
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(cacheManager.getStats().metrics.misses).toBe(1)
    })

    it('should return cached data on cache hit', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      const result = await cacheManager.get('key1', 'warm', fetcher)

      expect(result).toEqual({ data: 'test' })
      expect(fetcher).toHaveBeenCalledTimes(1) // Only called once
      expect(cacheManager.getStats().metrics.hits).toBe(1)
    })

    it('should respect hot cache TTL (10s)', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'hot', fetcher)
      vi.advanceTimersByTime(5000) // 5s
      await cacheManager.get('key1', 'hot', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1) // Still cached

      vi.advanceTimersByTime(6000) // 11s total
      await cacheManager.get('key1', 'hot', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(2) // Cache expired
    })

    it('should respect warm cache TTL (60s)', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      vi.advanceTimersByTime(30000) // 30s
      await cacheManager.get('key1', 'warm', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1) // Still cached

      vi.advanceTimersByTime(31000) // 61s total
      await cacheManager.get('key1', 'warm', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(2) // Cache expired
    })

    it('should respect cold cache TTL (5min)', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'cold', fetcher)
      vi.advanceTimersByTime(240000) // 4min
      await cacheManager.get('key1', 'cold', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1) // Still cached

      vi.advanceTimersByTime(61000) // 5min 1s total
      await cacheManager.get('key1', 'cold', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(2) // Cache expired
    })

    it('should deduplicate concurrent requests', async () => {
      let resolveCount = 0
      const fetcher = vi.fn(async () => {
        resolveCount++
        return { data: `test${resolveCount}` }
      })

      // Fire 3 concurrent requests for same key
      const promises = [
        cacheManager.get('key1', 'warm', fetcher),
        cacheManager.get('key1', 'warm', fetcher),
        cacheManager.get('key1', 'warm', fetcher),
      ]

      const results = await Promise.all(promises)

      expect(fetcher).toHaveBeenCalledTimes(1) // Only executed once
      expect(results).toEqual([
        { data: 'test1' },
        { data: 'test1' },
        { data: 'test1' },
      ])
      expect(cacheManager.getStats().metrics.deduped).toBe(2)
    })

    it('should serve stale cache when fetcher fails', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: 'test' })
        .mockRejectedValueOnce(new Error('Network error'))

      // First call succeeds
      await cacheManager.get('key1', 'warm', fetcher)
      vi.advanceTimersByTime(70000) // Expire cache

      // Second call fails but should return stale cache
      const result = await cacheManager.get('key1', 'warm', fetcher, { allowStale: true })
      expect(result).toEqual({ data: 'test' })
      expect(cacheManager.getStats().metrics.staleServed).toBe(1)
    })

    it('should throw error when fetcher fails and no stale cache available', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(cacheManager.get('key1', 'warm', fetcher)).rejects.toThrow('Network error')
    })
  })

  describe('invalidate()', () => {
    it('should remove cache entry', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      cacheManager.invalidate('key1')
      
      const stats = cacheManager.getStats()
      expect(stats.size).toBe(0)
    })

    it('should trigger refetch after invalidation', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      cacheManager.invalidate('key1')
      await cacheManager.get('key1', 'warm', fetcher)

      expect(fetcher).toHaveBeenCalledTimes(2)
    })
  })

  describe('SSE event integration', () => {
    it('should invalidate heartbeat cache on data-update event', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('heartbeat', 'hot', fetcher)
      eventBus.emit('data-update', { channel: 'heartbeat' })
      
      // Allow event to process
      await vi.runAllTimersAsync()
      
      const stats = cacheManager.getStats()
      expect(stats.size).toBe(0)
    })

    it('should invalidate issues cache on data-update event', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('issues:open', 'warm', fetcher)
      eventBus.emit('data-update', { channel: 'issues' })
      
      // Allow event to process
      await vi.runAllTimersAsync()
      
      const stats = cacheManager.getStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('getStats()', () => {
    it('should return cache statistics', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      await cacheManager.get('key1', 'warm', fetcher)
      await cacheManager.get('key2', 'hot', fetcher)

      const stats = cacheManager.getStats()
      expect(stats.size).toBe(2)
      expect(stats.metrics.hits).toBe(1)
      expect(stats.metrics.misses).toBe(2)
      expect(stats.hitRate).toBe('33.33%')
    })

    it('should calculate hit rate correctly when no requests', () => {
      const stats = cacheManager.getStats()
      expect(stats.hitRate).toBe('0%')
    })

    it('should include cache entry details', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      
      const stats = cacheManager.getStats()
      expect(stats.entries).toHaveLength(1)
      expect(stats.entries[0]).toMatchObject({
        key: 'key1',
        tier: 'warm',
        stale: false,
      })
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0)
    })
  })

  describe('clear()', () => {
    it('should remove all cache entries', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }))
      
      await cacheManager.get('key1', 'warm', fetcher)
      await cacheManager.get('key2', 'hot', fetcher)
      
      cacheManager.clear()
      
      const stats = cacheManager.getStats()
      expect(stats.size).toBe(0)
    })
  })
})
