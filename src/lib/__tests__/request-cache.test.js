import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRequestCache } from '../request-cache.js'

describe('request-cache', () => {
  let cache

  beforeEach(() => {
    cache = createRequestCache({ defaultTTL: 1000 })
  })

  describe('dedupedFetch', () => {
    it('calls fetchFn and returns data', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      const result = await cache.dedupedFetch('/api/test', fetchFn)
      expect(result).toEqual({ ok: true })
      expect(fetchFn).toHaveBeenCalledOnce()
    })

    it('returns cached data on subsequent calls within TTL', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      await cache.dedupedFetch('/api/test', fetchFn)
      const result = await cache.dedupedFetch('/api/test', fetchFn)
      expect(result).toEqual({ ok: true })
      expect(fetchFn).toHaveBeenCalledOnce()
    })

    it('refetches after TTL expires', async () => {
      vi.useFakeTimers()
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ v: 1 })
        .mockResolvedValueOnce({ v: 2 })

      const first = await cache.dedupedFetch('/api/test', fetchFn)
      expect(first).toEqual({ v: 1 })

      vi.advanceTimersByTime(1001)

      const second = await cache.dedupedFetch('/api/test', fetchFn)
      expect(second).toEqual({ v: 2 })
      expect(fetchFn).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })

    it('deduplicates concurrent identical requests', async () => {
      let resolvePromise
      const fetchFn = vi.fn().mockImplementation(() =>
        new Promise(resolve => { resolvePromise = resolve })
      )

      const p1 = cache.dedupedFetch('/api/test', fetchFn)
      const p2 = cache.dedupedFetch('/api/test', fetchFn)
      const p3 = cache.dedupedFetch('/api/test', fetchFn)

      resolvePromise({ deduped: true })

      const [r1, r2, r3] = await Promise.all([p1, p2, p3])
      expect(r1).toEqual({ deduped: true })
      expect(r2).toEqual({ deduped: true })
      expect(r3).toEqual({ deduped: true })
      expect(fetchFn).toHaveBeenCalledOnce()
    })

    it('does not deduplicate different URLs', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      await Promise.all([
        cache.dedupedFetch('/api/a', fetchFn),
        cache.dedupedFetch('/api/b', fetchFn),
      ])
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('does not cache errors', async () => {
      const fetchFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ ok: true })

      await expect(cache.dedupedFetch('/api/test', fetchFn)).rejects.toThrow('fail')
      const result = await cache.dedupedFetch('/api/test', fetchFn)
      expect(result).toEqual({ ok: true })
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('propagates errors to all deduped callers', async () => {
      let rejectPromise
      const fetchFn = vi.fn().mockImplementation(() =>
        new Promise((_, reject) => { rejectPromise = reject })
      )

      const p1 = cache.dedupedFetch('/api/test', fetchFn)
      const p2 = cache.dedupedFetch('/api/test', fetchFn)

      rejectPromise(new Error('boom'))

      await expect(p1).rejects.toThrow('boom')
      await expect(p2).rejects.toThrow('boom')
      expect(fetchFn).toHaveBeenCalledOnce()
    })

    it('respects noCache option', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ v: 1 })
        .mockResolvedValueOnce({ v: 2 })

      await cache.dedupedFetch('/api/test', fetchFn)
      const result = await cache.dedupedFetch('/api/test', fetchFn, { noCache: true })
      expect(result).toEqual({ v: 2 })
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('respects custom TTL per call', async () => {
      vi.useFakeTimers()
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ v: 1 })
        .mockResolvedValueOnce({ v: 2 })

      await cache.dedupedFetch('/api/test', fetchFn, { ttl: 500 })
      vi.advanceTimersByTime(501)
      const result = await cache.dedupedFetch('/api/test', fetchFn)
      expect(result).toEqual({ v: 2 })
      vi.useRealTimers()
    })

    it('does not cache when ttl is 0', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ v: 1 })
        .mockResolvedValueOnce({ v: 2 })

      await cache.dedupedFetch('/api/test', fetchFn, { ttl: 0 })
      const result = await cache.dedupedFetch('/api/test', fetchFn)
      expect(result).toEqual({ v: 2 })
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('invalidate', () => {
    it('removes a specific cache entry', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ v: 1 })
        .mockResolvedValueOnce({ v: 2 })

      await cache.dedupedFetch('/api/test', fetchFn)
      cache.invalidate('/api/test')
      const result = await cache.dedupedFetch('/api/test', fetchFn)
      expect(result).toEqual({ v: 2 })
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('does not affect other cache entries', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      await cache.dedupedFetch('/api/a', fetchFn)
      await cache.dedupedFetch('/api/b', fetchFn)
      cache.invalidate('/api/a')
      await cache.dedupedFetch('/api/b', fetchFn)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('clear', () => {
    it('removes all cache entries', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      await cache.dedupedFetch('/api/a', fetchFn)
      await cache.dedupedFetch('/api/b', fetchFn)
      cache.clear()

      await cache.dedupedFetch('/api/a', fetchFn)
      await cache.dedupedFetch('/api/b', fetchFn)
      expect(fetchFn).toHaveBeenCalledTimes(4)
    })
  })

  describe('getStats', () => {
    it('returns cache statistics', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      await cache.dedupedFetch('/api/a', fetchFn)
      await cache.dedupedFetch('/api/b', fetchFn)

      const stats = cache.getStats()
      expect(stats.cacheSize).toBe(2)
      expect(stats.inflightCount).toBe(0)
      expect(stats.entries).toHaveLength(2)
      expect(stats.entries[0]).toMatchObject({ key: '/api/a', fresh: true })
    })

    it('marks expired entries as not fresh', async () => {
      vi.useFakeTimers()
      const fetchFn = vi.fn().mockResolvedValue({ ok: true })
      await cache.dedupedFetch('/api/test', fetchFn)
      vi.advanceTimersByTime(1001)

      const stats = cache.getStats()
      expect(stats.entries[0].fresh).toBe(false)
      vi.useRealTimers()
    })
  })
})
