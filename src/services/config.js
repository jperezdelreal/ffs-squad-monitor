/**
 * Frontend config service — fetches REPOS and AGENTS from /api/config.
 * Single source of truth is server/config.js; this module caches the result.
 */

let configCache = null
let configPromise = null

export async function fetchConfig() {
  if (configCache) return configCache
  if (configPromise) return configPromise

  configPromise = fetch('/api/config')
    .then(res => {
      if (!res.ok) throw new Error(`Config fetch failed: HTTP ${res.status}`)
      return res.json()
    })
    .then(data => {
      configCache = data
      configPromise = null
      return data
    })
    .catch(err => {
      configPromise = null
      console.error('[Config] Failed to load config:', err.message)
      throw err
    })

  return configPromise
}

export function getConfigSync() {
  return configCache
}

export function clearConfigCache() {
  configCache = null
  configPromise = null
}
