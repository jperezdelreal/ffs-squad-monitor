/**
 * Request deduplication and caching layer.
 * - Deduplicates concurrent identical requests (only 1 network call fires)
 * - Caches responses with configurable TTL
 * - Errors are never cached — subsequent calls retry immediately
 */

const DEFAULT_TTL = 30_000

export function createRequestCache({ defaultTTL = DEFAULT_TTL } = {}) {
  const cache = new Map()
  const inflight = new Map()

  function getCached(key) {
    const entry = cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key)
      return undefined
    }
    return entry.data
  }

  /**
   * Execute fetchFn with deduplication and caching.
   * @param {string} key - Cache key (typically the URL)
   * @param {() => Promise} fetchFn - Function that performs the actual fetch
   * @param {{ ttl?: number, noCache?: boolean }} options
   */
  async function dedupedFetch(key, fetchFn, options = {}) {
    const ttl = options.ttl ?? defaultTTL
    const noCache = options.noCache ?? false

    if (!noCache) {
      const cached = getCached(key)
      if (cached !== undefined) return cached
    }

    if (inflight.has(key)) return inflight.get(key)

    const promise = fetchFn()
      .then(data => {
        inflight.delete(key)
        if (ttl > 0 && !noCache) {
          cache.set(key, { data, timestamp: Date.now(), ttl })
        }
        return data
      })
      .catch(err => {
        inflight.delete(key)
        throw err
      })

    inflight.set(key, promise)
    return promise
  }

  function invalidate(key) {
    cache.delete(key)
  }

  function clear() {
    cache.clear()
    inflight.clear()
  }

  function getStats() {
    const now = Date.now()
    return {
      cacheSize: cache.size,
      inflightCount: inflight.size,
      entries: [...cache.entries()].map(([key, entry]) => ({
        key,
        age: now - entry.timestamp,
        ttl: entry.ttl,
        fresh: now - entry.timestamp <= entry.ttl,
      })),
    }
  }

  return { dedupedFetch, invalidate, clear, getStats }
}
