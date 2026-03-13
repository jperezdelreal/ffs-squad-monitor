import { describe, it, expect } from 'vitest'
import {
  connectionScore,
  heartbeatScore,
  heartbeatStaleness,
  apiErrorScore,
  computeHealthScore,
  healthLevel,
  healthBreakdown,
  formatAge,
  STALENESS_THRESHOLDS,
  HEALTH_LEVELS,
} from '../health.js'

describe('connectionScore', () => {
  it('returns 100 for operational', () => {
    expect(connectionScore('operational')).toBe(100)
  })

  it('returns 50 for degraded', () => {
    expect(connectionScore('degraded')).toBe(50)
  })

  it('returns 0 for offline', () => {
    expect(connectionScore('offline')).toBe(0)
  })

  it('returns 0 for unknown', () => {
    expect(connectionScore('unknown')).toBe(0)
  })

  it('returns 0 for null/undefined', () => {
    expect(connectionScore(null)).toBe(0)
    expect(connectionScore(undefined)).toBe(0)
  })
})

describe('heartbeatScore', () => {
  it('returns 100 for fresh heartbeat (< 1 min)', () => {
    expect(heartbeatScore(0)).toBe(100)
    expect(heartbeatScore(30_000)).toBe(100)
    expect(heartbeatScore(60_000)).toBe(100)
  })

  it('decays linearly between 1 min and stale threshold', () => {
    const midpoint = (60_000 + STALENESS_THRESHOLDS.STALE_MS) / 2
    const score = heartbeatScore(midpoint)
    expect(score).toBeGreaterThan(40)
    expect(score).toBeLessThan(100)
  })

  it('returns 30 for stale heartbeat (between stale and dead)', () => {
    expect(heartbeatScore(STALENESS_THRESHOLDS.STALE_MS + 1000)).toBe(30)
    expect(heartbeatScore(STALENESS_THRESHOLDS.DEAD_MS - 1000)).toBe(30)
  })

  it('returns 0 for dead heartbeat (>= dead threshold)', () => {
    expect(heartbeatScore(STALENESS_THRESHOLDS.DEAD_MS)).toBe(0)
    expect(heartbeatScore(STALENESS_THRESHOLDS.DEAD_MS + 60_000)).toBe(0)
  })

  it('returns 0 for null/negative', () => {
    expect(heartbeatScore(null)).toBe(0)
    expect(heartbeatScore(-1)).toBe(0)
  })
})

describe('heartbeatStaleness', () => {
  it('returns fresh for age below stale threshold', () => {
    expect(heartbeatStaleness(0)).toBe('fresh')
    expect(heartbeatStaleness(60_000)).toBe('fresh')
    expect(heartbeatStaleness(STALENESS_THRESHOLDS.STALE_MS - 1)).toBe('fresh')
  })

  it('returns stale for age between stale and dead', () => {
    expect(heartbeatStaleness(STALENESS_THRESHOLDS.STALE_MS)).toBe('stale')
    expect(heartbeatStaleness(STALENESS_THRESHOLDS.DEAD_MS - 1)).toBe('stale')
  })

  it('returns dead for age >= dead threshold', () => {
    expect(heartbeatStaleness(STALENESS_THRESHOLDS.DEAD_MS)).toBe('dead')
    expect(heartbeatStaleness(STALENESS_THRESHOLDS.DEAD_MS + 10_000)).toBe('dead')
  })

  it('returns dead for null/negative', () => {
    expect(heartbeatStaleness(null)).toBe('dead')
    expect(heartbeatStaleness(-1)).toBe('dead')
  })

  it('accepts custom thresholds', () => {
    const custom = { STALE_MS: 1000, DEAD_MS: 5000 }
    expect(heartbeatStaleness(500, custom)).toBe('fresh')
    expect(heartbeatStaleness(2000, custom)).toBe('stale')
    expect(heartbeatStaleness(6000, custom)).toBe('dead')
  })
})

describe('apiErrorScore', () => {
  it('returns 100 when no errors', () => {
    expect(apiErrorScore(0, 5)).toBe(100)
  })

  it('returns 0 when all endpoints failed', () => {
    expect(apiErrorScore(5, 5)).toBe(0)
  })

  it('returns proportional score for partial failures', () => {
    expect(apiErrorScore(1, 4)).toBe(75)
    expect(apiErrorScore(2, 4)).toBe(50)
  })

  it('returns 100 when no endpoints tracked', () => {
    expect(apiErrorScore(0, 0)).toBe(100)
  })

  it('returns 100 for negative failed count', () => {
    expect(apiErrorScore(-1, 5)).toBe(100)
  })
})

describe('computeHealthScore', () => {
  it('returns 100 when all factors are perfect', () => {
    const score = computeHealthScore({
      connectionState: 'operational',
      heartbeatAgeMs: 0,
      apiFailedCount: 0,
      apiTotalCount: 5,
    })
    expect(score).toBe(100)
  })

  it('returns 0 when all factors are worst', () => {
    const score = computeHealthScore({
      connectionState: 'offline',
      heartbeatAgeMs: null,
      apiFailedCount: 5,
      apiTotalCount: 5,
    })
    expect(score).toBe(0)
  })

  it('returns middle score for mixed factors', () => {
    const score = computeHealthScore({
      connectionState: 'operational',
      heartbeatAgeMs: STALENESS_THRESHOLDS.DEAD_MS + 1,
      apiFailedCount: 0,
      apiTotalCount: 5,
    })
    // connection=100*0.35 + heartbeat=0*0.40 + api=100*0.25 = 35 + 0 + 25 = 60
    expect(score).toBe(60)
  })
})

describe('healthLevel', () => {
  it('returns green for score >= 70', () => {
    expect(healthLevel(100)).toBe(HEALTH_LEVELS.GREEN)
    expect(healthLevel(70)).toBe(HEALTH_LEVELS.GREEN)
  })

  it('returns yellow for score 40-69', () => {
    expect(healthLevel(69)).toBe(HEALTH_LEVELS.YELLOW)
    expect(healthLevel(40)).toBe(HEALTH_LEVELS.YELLOW)
  })

  it('returns red for score < 40', () => {
    expect(healthLevel(39)).toBe(HEALTH_LEVELS.RED)
    expect(healthLevel(0)).toBe(HEALTH_LEVELS.RED)
  })
})

describe('healthBreakdown', () => {
  it('returns three factors', () => {
    const factors = healthBreakdown({
      connectionState: 'operational',
      heartbeatAgeMs: 30_000,
      apiFailedCount: 0,
      apiTotalCount: 3,
    })
    expect(factors).toHaveLength(3)
    expect(factors.map(f => f.label)).toEqual(['Connection', 'Heartbeat', 'API Health'])
  })

  it('includes scores for each factor', () => {
    const factors = healthBreakdown({
      connectionState: 'operational',
      heartbeatAgeMs: 0,
      apiFailedCount: 0,
      apiTotalCount: 3,
    })
    factors.forEach(f => {
      expect(f).toHaveProperty('score')
      expect(f).toHaveProperty('value')
    })
  })

  it('shows No data when heartbeat age is null', () => {
    const factors = healthBreakdown({
      connectionState: 'offline',
      heartbeatAgeMs: null,
      apiFailedCount: 0,
      apiTotalCount: 0,
    })
    const hb = factors.find(f => f.label === 'Heartbeat')
    expect(hb.value).toContain('No data')
  })
})

describe('formatAge', () => {
  it('formats seconds', () => {
    expect(formatAge(5000)).toBe('5s')
    expect(formatAge(0)).toBe('0s')
  })

  it('formats minutes', () => {
    expect(formatAge(120_000)).toBe('2m')
    expect(formatAge(300_000)).toBe('5m')
  })

  it('formats hours', () => {
    expect(formatAge(7_200_000)).toBe('2h')
  })

  it('handles null/negative', () => {
    expect(formatAge(null)).toBe('Unknown')
    expect(formatAge(-1)).toBe('Unknown')
  })
})
