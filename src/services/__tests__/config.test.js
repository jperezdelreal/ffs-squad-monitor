import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchConfig, getConfigSync, clearConfigCache } from '../config.js'

describe('config service', () => {
  let mockFetch

  beforeEach(() => {
    clearConfigCache()
    mockFetch = vi.fn()
    global.fetch = mockFetch
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchConfig', () => {
    it('should fetch and return config from /api/config', async () => {
      const mockData = { REPOS: ['repo1'], AGENTS: ['agent1'] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const result = await fetchConfig()

      expect(mockFetch).toHaveBeenCalledWith('/api/config')
      expect(result).toEqual(mockData)
    })

    it('should return cached config on subsequent calls', async () => {
      const mockData = { REPOS: ['repo1'], AGENTS: ['agent1'] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const first = await fetchConfig()
      const second = await fetchConfig()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(second).toBe(first)
    })

    it('should deduplicate concurrent requests', async () => {
      const mockData = { REPOS: ['repo1'] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const [r1, r2] = await Promise.all([fetchConfig(), fetchConfig()])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(r1).toEqual(mockData)
      expect(r2).toEqual(mockData)
    })

    it('should throw on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })

      await expect(fetchConfig()).rejects.toThrow('Config fetch failed: HTTP 500')
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(fetchConfig()).rejects.toThrow('Network error')
    })

    it('should clear configPromise on error so retries work', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Temporary failure'))

      await expect(fetchConfig()).rejects.toThrow('Temporary failure')

      const mockData = { REPOS: ['repo1'] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const result = await fetchConfig()
      expect(result).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getConfigSync', () => {
    it('should return null before config is fetched', () => {
      expect(getConfigSync()).toBeNull()
    })

    it('should return cached config after fetch', async () => {
      const mockData = { REPOS: ['repo1'] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      await fetchConfig()

      expect(getConfigSync()).toEqual(mockData)
    })
  })

  describe('clearConfigCache', () => {
    it('should clear the cached config', async () => {
      const mockData = { REPOS: ['repo1'] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      await fetchConfig()
      expect(getConfigSync()).toEqual(mockData)

      clearConfigCache()
      expect(getConfigSync()).toBeNull()
    })

    it('should force re-fetch after clearing', async () => {
      const firstData = { REPOS: ['repo1'] }
      const secondData = { REPOS: ['repo2'] }
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => firstData })
        .mockResolvedValueOnce({ ok: true, json: async () => secondData })

      await fetchConfig()
      clearConfigCache()
      const result = await fetchConfig()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual(secondData)
    })
  })
})
