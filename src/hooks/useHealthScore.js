import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/store'
import { getConnectionState, onConnectionChange } from '../lib/api'
import {
  computeHealthScore,
  healthLevel,
  healthBreakdown,
  heartbeatStaleness,
  STALENESS_THRESHOLDS,
} from '../lib/health'

/**
 * React hook that computes real-time health score from store + API state.
 * Re-evaluates every second so heartbeat age stays current.
 */
export function useHealthScore(thresholds = STALENESS_THRESHOLDS) {
  const { lastUpdate } = useStore()
  const [connectionState, setConnectionState] = useState(getConnectionState)
  const [tick, setTick] = useState(0)

  // Subscribe to connection state changes from api.js
  useEffect(() => {
    const unsubscribe = onConnectionChange(setConnectionState)
    return unsubscribe
  }, [])

  // Tick every second so heartbeat age recalculates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const heartbeatAgeMs = lastUpdate != null ? Date.now() - lastUpdate : null

  const score = computeHealthScore({
    connectionState,
    heartbeatAgeMs,
    apiFailedCount: 0,
    apiTotalCount: 0,
  })

  const level = healthLevel(score)
  const breakdown = healthBreakdown({
    connectionState,
    heartbeatAgeMs,
    apiFailedCount: 0,
    apiTotalCount: 0,
  })
  const staleness = heartbeatStaleness(heartbeatAgeMs, thresholds)

  return { score, level, breakdown, staleness, heartbeatAgeMs }
}
