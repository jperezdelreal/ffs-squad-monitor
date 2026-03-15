import { useEffect, useRef, useCallback, useState } from 'react'
import { useStore } from '../store/store'

const MAX_BACKOFF_MS = 30_000
const FALLBACK_THRESHOLD = 3
const FALLBACK_RETRY_MS = 60_000
const DATA_CHANNELS = ['heartbeat', 'events', 'issues', 'usage']

/**
 * Custom hook that connects to the SSE endpoint and pushes real-time
 * updates into the Zustand store.  Falls back to polling after
 * FALLBACK_THRESHOLD consecutive connection failures.
 *
 * @param {Object}  opts
 * @param {string[]} opts.channels - SSE channels to subscribe to
 * @returns {{ status: string, error: string|null, reconnect: Function }}
 */
export function useSSE({ channels = DATA_CHANNELS } = {}) {
  const setSseStatus = useStore(s => s.setSseStatus)
  const handleSSEEvent = useStore(s => s.handleSSEEvent)
  const refreshAll = useStore(s => s.refreshAll)

  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)

  const esRef = useRef(null)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const fallbackTimerRef = useRef(null)
  const fallbackIntervalRef = useRef(null)
  const lastEventIdRef = useRef(null)
  const mountedRef = useRef(true)

  const updateStatus = useCallback((s) => {
    if (!mountedRef.current) return
    setStatus(s)
    setSseStatus(s)
  }, [setSseStatus])

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const startPollingFallback = useCallback(() => {
    updateStatus('polling')
    refreshAll()
    fallbackIntervalRef.current = setInterval(refreshAll, 60_000)
  }, [updateStatus, refreshAll])

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    if (!mountedRef.current) return

    const channelParam = channels.join(',')
    const url = `/api/sse?channels=${channelParam}`

    updateStatus(attemptsRef.current === 0 ? 'connecting' : 'reconnecting')
    setError(null)

    let es
    try {
      es = new EventSource(url)
    } catch (err) {
      handleConnectionError(err.message)
      return
    }

    esRef.current = es

    es.addEventListener('connected', () => {
      if (!mountedRef.current) return
      attemptsRef.current = 0
      updateStatus('streaming')
      setError(null)

      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current)
        fallbackIntervalRef.current = null
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    })

    for (const channel of channels) {
      es.addEventListener(`${channel}:snapshot`, makeHandler(channel))
      if (channel === 'events') {
        es.addEventListener(`${channel}:new`, makeHandler(channel))
      } else if (channel === 'issues') {
        es.addEventListener(`${channel}:update`, makeHandler(channel))
        es.addEventListener(`${channel}:new`, makeHandler(channel))
      } else {
        es.addEventListener(`${channel}:update`, makeHandler(channel))
      }
    }

    es.onerror = () => {
      if (!mountedRef.current) return
      es.close()
      esRef.current = null
      handleConnectionError('SSE connection lost')
    }

    function makeHandler(channel) {
      return (event) => {
        if (!mountedRef.current) return
        if (event.lastEventId) {
          lastEventIdRef.current = event.lastEventId
        }
        try {
          const sseEvent = JSON.parse(event.data)
          handleSSEEvent(channel, sseEvent.type || event.type, sseEvent.data)
        } catch {
          // Malformed event data
        }
      }
    }

    function handleConnectionError(msg) {
      if (!mountedRef.current) return
      attemptsRef.current++
      setError(msg)

      if (attemptsRef.current >= FALLBACK_THRESHOLD) {
        startPollingFallback()
        fallbackTimerRef.current = setTimeout(() => {
          attemptsRef.current = 0
          connect()
        }, FALLBACK_RETRY_MS)
        return
      }

      const delay = Math.min(1000 * Math.pow(2, attemptsRef.current - 1), MAX_BACKOFF_MS)
      updateStatus('reconnecting')
      reconnectTimerRef.current = setTimeout(connect, delay)
    }
  }, [channels, updateStatus, handleSSEEvent, startPollingFallback])

  const reconnect = useCallback(() => {
    cleanup()
    attemptsRef.current = 0
    connect()
  }, [cleanup, connect])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      cleanup()
      setSseStatus('disconnected')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, error, reconnect }
}
