import { logger } from './logger.js'
import { eventBus } from './event-bus.js'

/**
 * Tiered caching with request deduplication and graceful degradation.
 * 
 * Cache Tiers:
 * - Hot: 10s TTL (heartbeat, pulse) — frequent changes
 * - Warm: 60s TTL (issues, PRs, events) — moderate changes
 * - Cold: 300s TTL (repos, agents, config) — rare changes
 * 
 * Features:
 * - Request deduplication (collapse concurrent identical requests)
 * - Stale-while-revalidate pattern (serve stale on rate limit)
 * - Cache invalidation on SSE events
 * - Hit/miss metrics tracking
 */

const CACHE_TIERS = {
  hot: 10_000,    // 10 seconds
  warm: 60_000,   // 60 seconds
  cold: 300_000,  // 5 minutes
}

class CacheManager {
  constructor() {
    this.cache = new Map() // key -> { data, timestamp, tier, stale }
    this.pendingRequests = new Map() // key -> Promise (for deduplication)
    this.metrics = {
      hits: 0,
      misses: 0,
      deduped: 0,
      staleServed: 0,
    }

    // Listen for SSE events to invalidate cache
    this.setupEventListeners()
  }

  setupEventListeners() {
    // Invalidate relevant cache keys on data updates
    eventBus.on('data-update', (event) => {
      if (!event || !event.channel) return
      
      if (event.channel === 'heartbeat') {
        this.invalidate('heartbeat')
      } else if (event.channel === 'pulse') {
        this.invalidate('pulse')
      } else if (event.channel === 'issues') {
        this.invalidate('issues:open')
        this.invalidate('issues:all')
      } else if (event.channel === 'events') {
        this.invalidate('events')
      }
    })
  }

  /**
   * Get from cache or execute fetcher function.
   * Implements request deduplication and stale-while-revalidate.
   */
  async get(key, tier, fetcher, options = {}) {
    const { allowStale = true } = options
    const ttl = CACHE_TIERS[tier] || CACHE_TIERS.warm
    const now = Date.now()

    // Check cache
    const cached = this.cache.get(key)
    if (cached) {
      const age = now - cached.timestamp
      
      // Fresh hit
      if (age < ttl) {
        this.metrics.hits++
        return cached.data
      }

      // Cache expired - try to fetch fresh, but fall back to stale if allowed
    }

    // Request deduplication: if already fetching, return that promise
    if (this.pendingRequests.has(key)) {
      this.metrics.deduped++
      logger.debug('Request deduplicated', { key })
      return this.pendingRequests.get(key)
    }

    // Execute fetcher
    this.metrics.misses++
    const promise = this.executeFetcher(key, tier, fetcher, { allowStale, cached })
    this.pendingRequests.set(key, promise)

    try {
      const result = await promise
      return result
    } finally {
      this.pendingRequests.delete(key)
    }
  }

  async executeFetcher(key, tier, fetcher, { allowStale, cached } = {}) {
    try {
      const data = await fetcher()
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        tier,
        stale: false,
      })
      logger.debug('Cache set', { key, tier })
      return data
    } catch (error) {
      // On error, serve stale cache if allowed
      if (allowStale && cached) {
        this.metrics.staleServed++
        logger.warn('Fetcher failed, serving stale cache', { key, error: error.message })
        // Mark as stale for future reference
        cached.stale = true
        return cached.data
      }
      throw error
    }
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key) {
    const deleted = this.cache.delete(key)
    if (deleted) {
      logger.debug('Cache invalidated', { key })
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear()
    this.pendingRequests.clear()
    logger.info('Cache cleared')
  }

  /**
   * Get cache statistics for health endpoint
   */
  getStats() {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      tier: value.tier,
      age: Date.now() - value.timestamp,
      stale: value.stale,
    }))

    return {
      size: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      metrics: { ...this.metrics },
      hitRate: this.metrics.hits + this.metrics.misses > 0
        ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(2) + '%'
        : '0%',
      entries: entries.slice(0, 20), // Top 20 entries
    }
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      deduped: 0,
      staleServed: 0,
    }
  }
}

export const cacheManager = new CacheManager()
