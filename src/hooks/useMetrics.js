import { useState, useEffect, useCallback, useRef } from 'react'

export function useMetrics(channel, timeRange = '7d') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const from = computeFrom(timeRange)
      const interval = timeRange === '7d' ? '1h' : timeRange === '30d' ? '6h' : '1d'
      const url = `/api/metrics?channel=${encodeURIComponent(channel)}&from=${encodeURIComponent(from)}&interval=${interval}`

      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`[useMetrics] Failed to fetch ${channel}:`, err)
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [channel, timeRange])

  useEffect(() => {
    fetchData()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

function computeFrom(timeRange) {
  const now = Date.now()
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}
