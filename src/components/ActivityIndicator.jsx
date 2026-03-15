import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

/**
 * ActivityIndicator - Shows time since last SSE event with pulse animation on update
 */
export function ActivityIndicator({ lastUpdate }) {
  const [timeSince, setTimeSince] = useState('')
  const [justUpdated, setJustUpdated] = useState(false)

  // Update time display every second
  useEffect(() => {
    const updateTimeSince = () => {
      if (!lastUpdate) {
        setTimeSince('')
        return
      }

      const now = Date.now()
      const updateTime = new Date(lastUpdate).getTime()
      const diffMs = now - updateTime
      const diffSec = Math.floor(diffMs / 1000)

      if (diffSec < 5) {
        setTimeSince('just now')
      } else if (diffSec < 60) {
        setTimeSince(`${diffSec}s ago`)
      } else if (diffSec < 3600) {
        const minutes = Math.floor(diffSec / 60)
        setTimeSince(`${minutes}m ago`)
      } else {
        const hours = Math.floor(diffSec / 3600)
        setTimeSince(`${hours}h ago`)
      }
    }

    updateTimeSince()
    const interval = setInterval(updateTimeSince, 1000)

    return () => clearInterval(interval)
  }, [lastUpdate])

  // Trigger pulse animation when lastUpdate changes
  useEffect(() => {
    if (!lastUpdate) return

    setJustUpdated(true)
    const timeout = setTimeout(() => setJustUpdated(false), 1000)

    return () => clearTimeout(timeout)
  }, [lastUpdate])

  if (!timeSince) return null

  return (
    <motion.div
      className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-400 light:text-gray-500"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        animate={justUpdated ? {
          scale: [1, 1.2, 1],
          opacity: [0.6, 1, 0.6],
        } : {}}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        <svg 
          className="w-3 h-3" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="8" opacity="0.2" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        {justUpdated && (
          <motion.div
            className="absolute inset-0 rounded-full bg-green-400"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </motion.div>
      <span className="font-mono">
        Updated {timeSince}
      </span>
    </motion.div>
  )
}
