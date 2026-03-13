import { useEffect } from 'react'
import { useStore } from '../store/store'

const POLL_INTERVAL = 60000

export function usePolling() {
  const { refreshAll, lastUpdate, isConnected } = useStore()

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return { lastUpdate, isConnected }
}
