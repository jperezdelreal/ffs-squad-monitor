/**
 * Health score computation — pure functions for global dashboard health.
 * Score 0–100 maps to: green (≥70), yellow (40–69), red (<40).
 *
 * Factors:
 *   - Connection state (operational/degraded/offline)
 *   - Heartbeat staleness (age vs thresholds)
 *   - API error rate (failed endpoints / total)
 */

export const STALENESS_THRESHOLDS = {
  STALE_MS: 5 * 60 * 1000,   // 5 minutes
  DEAD_MS: 30 * 60 * 1000,   // 30 minutes
}

export const HEALTH_LEVELS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
}

/**
 * Compute a 0–100 score from connection state.
 * operational=100, degraded=50, offline/unknown=0
 */
export function connectionScore(state) {
  switch (state) {
    case 'operational': return 100
    case 'degraded': return 50
    case 'offline': return 0
    default: return 0
  }
}

/**
 * Compute a 0–100 score from heartbeat age in milliseconds.
 * Fresh (<1 min) = 100, approaching stale = linear decay, stale = 30, dead = 0
 */
export function heartbeatScore(ageMs) {
  if (ageMs == null || ageMs < 0) return 0
  if (ageMs <= 60_000) return 100
  if (ageMs <= STALENESS_THRESHOLDS.STALE_MS) {
    // Linear decay from 100 → 40 over 1 min → 5 min
    const range = STALENESS_THRESHOLDS.STALE_MS - 60_000
    const elapsed = ageMs - 60_000
    return Math.round(100 - (60 * elapsed / range))
  }
  if (ageMs < STALENESS_THRESHOLDS.DEAD_MS) return 30
  return 0
}

/**
 * Classify heartbeat staleness.
 * Returns 'fresh' | 'stale' | 'dead'
 */
export function heartbeatStaleness(ageMs, thresholds = STALENESS_THRESHOLDS) {
  if (ageMs == null || ageMs < 0) return 'dead'
  if (ageMs < thresholds.STALE_MS) return 'fresh'
  if (ageMs < thresholds.DEAD_MS) return 'stale'
  return 'dead'
}

/**
 * Compute API error rate score.
 * 0 errors = 100, all errors = 0, linear scale.
 */
export function apiErrorScore(failedCount, totalCount) {
  if (totalCount <= 0) return 100
  if (failedCount <= 0) return 100
  if (failedCount >= totalCount) return 0
  return Math.round(100 * (1 - failedCount / totalCount))
}

/**
 * Compute the overall health score (0–100) from individual factors.
 * Weights: connection 35%, heartbeat 40%, API errors 25%
 */
export function computeHealthScore({ connectionState, heartbeatAgeMs, apiFailedCount, apiTotalCount }) {
  const conn = connectionScore(connectionState)
  const hb = heartbeatScore(heartbeatAgeMs)
  const api = apiErrorScore(apiFailedCount, apiTotalCount)

  return Math.round(conn * 0.35 + hb * 0.40 + api * 0.25)
}

/**
 * Map a 0–100 score to a health level color.
 */
export function healthLevel(score) {
  if (score >= 70) return HEALTH_LEVELS.GREEN
  if (score >= 40) return HEALTH_LEVELS.YELLOW
  return HEALTH_LEVELS.RED
}

/**
 * Build a human-readable breakdown of health factors.
 */
export function healthBreakdown({ connectionState, heartbeatAgeMs, apiFailedCount, apiTotalCount }) {
  const factors = []

  factors.push({
    label: 'Connection',
    value: connectionState || 'unknown',
    score: connectionScore(connectionState),
  })

  const staleness = heartbeatStaleness(heartbeatAgeMs)
  const ageLabel = heartbeatAgeMs != null
    ? formatAge(heartbeatAgeMs)
    : 'No data'
  factors.push({
    label: 'Heartbeat',
    value: `${ageLabel} (${staleness})`,
    score: heartbeatScore(heartbeatAgeMs),
  })

  const errorRate = apiTotalCount > 0
    ? `${apiFailedCount}/${apiTotalCount} failed`
    : 'No endpoints tracked'
  factors.push({
    label: 'API Health',
    value: errorRate,
    score: apiErrorScore(apiFailedCount, apiTotalCount),
  })

  return factors
}

/**
 * Format milliseconds into human-readable age string.
 */
export function formatAge(ms) {
  if (ms == null || ms < 0) return 'Unknown'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}
