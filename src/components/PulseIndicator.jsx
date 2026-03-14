import React from 'react'
import { motion } from 'framer-motion'

export function PulseDot({ status = 'streaming', size = 'sm', showLabel = false }) {
  const config = {
    streaming: {
      color: 'bg-emerald-400',
      ringColor: 'ring-emerald-400/30',
      label: 'Live',
      ariaLabel: 'Streaming data',
    },
    polling: {
      color: 'bg-amber-400',
      ringColor: 'ring-amber-400/30',
      label: 'Polling',
      ariaLabel: 'Polling for updates',
    },
    disconnected: {
      color: 'bg-red-500',
      ringColor: 'ring-red-500/30',
      label: 'Offline',
      ariaLabel: 'Disconnected',
    },
  }

  const statusConfig = config[status] || config.disconnected
  
  const sizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  const dotSize = sizeClasses[size] || sizeClasses.sm

  return (
    <div className="flex items-center gap-1.5" role="status" aria-label={statusConfig.ariaLabel}>
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring - only for streaming */}
        {status === 'streaming' && (
          <>
            <motion.div
              className={`absolute ${dotSize} rounded-full ${statusConfig.color} opacity-75`}
              animate={{
                scale: [1, 2, 2],
                opacity: [0.75, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
            <motion.div
              className={`absolute ${dotSize} rounded-full ${statusConfig.color} opacity-75`}
              animate={{
                scale: [1, 2, 2],
                opacity: [0.75, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
                delay: 1,
              }}
            />
          </>
        )}
        
        {/* Core dot */}
        <motion.div
          className={`${dotSize} rounded-full ${statusConfig.color} ring-4 ${statusConfig.ringColor}`}
          animate={status === 'streaming' ? {
            scale: [1, 1.1, 1],
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
      
      {showLabel && (
        <span className="text-xs font-medium text-gray-400">
          {statusConfig.label}
        </span>
      )}
    </div>
  )
}

export function DataGlow({ children, isActive = false, glowColor = 'emerald' }) {
  const glowColors = {
    emerald: 'shadow-emerald-500/50',
    amber: 'shadow-amber-500/50',
    cyan: 'shadow-cyan-500/50',
    blue: 'shadow-blue-500/50',
  }

  const shadowClass = glowColors[glowColor] || glowColors.emerald

  return (
    <motion.div
      animate={isActive ? {
        boxShadow: [
          '0 0 0px rgba(6, 182, 212, 0)',
          '0 0 20px rgba(6, 182, 212, 0.6)',
          '0 0 0px rgba(6, 182, 212, 0)',
        ],
      } : {}}
      transition={{
        duration: 1.5,
        ease: 'easeInOut',
      }}
      className="relative"
    >
      {children}
    </motion.div>
  )
}

export function CounterAnimation({ value, duration = 500, className = '' }) {
  const [displayValue, setDisplayValue] = React.useState(value)
  const [prevValue, setPrevValue] = React.useState(value)

  React.useEffect(() => {
    if (value !== prevValue) {
      const start = prevValue
      const end = value
      const startTime = Date.now()
      
      const animate = () => {
        const now = Date.now()
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        const easeOut = 1 - Math.pow(1 - progress, 3)
        const current = Math.round(start + (end - start) * easeOut)
        
        setDisplayValue(current)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setPrevValue(end)
        }
      }
      
      requestAnimationFrame(animate)
    }
  }, [value, prevValue, duration])

  return (
    <motion.span
      key={value}
      initial={{ scale: 1.2, color: 'rgb(6, 182, 212)' }}
      animate={{ scale: 1, color: 'inherit' }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {displayValue}
    </motion.span>
  )
}

export function LiveTimestamp({ timestamp, prefix = '', className = '' }) {
  const [relativeTime, setRelativeTime] = React.useState('')

  const updateTime = React.useCallback(() => {
    if (!timestamp) {
      setRelativeTime('Never')
      return
    }

    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    
    if (seconds < 5) {
      setRelativeTime('just now')
    } else if (seconds < 60) {
      setRelativeTime(`${seconds}s ago`)
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      setRelativeTime(`${minutes}m ago`)
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600)
      setRelativeTime(`${hours}h ago`)
    } else {
      const days = Math.floor(seconds / 86400)
      setRelativeTime(`${days}d ago`)
    }
  }, [timestamp])

  React.useEffect(() => {
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [updateTime])

  return (
    <span className={className}>
      {prefix && `${prefix} `}
      {relativeTime}
    </span>
  )
}

export function BreathingBorder({ children, isActive = false, colorClass = 'border-cyan-500/50' }) {
  return (
    <motion.div
      animate={isActive ? {
        borderColor: [
          'rgba(6, 182, 212, 0.1)',
          'rgba(6, 182, 212, 0.5)',
          'rgba(6, 182, 212, 0.1)',
        ],
      } : {}}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`border ${isActive ? colorClass : 'border-white/10'}`}
    >
      {children}
    </motion.div>
  )
}

export function SignalBars({ strength = 3, className = '' }) {
  const bars = [
    { height: 'h-2', active: strength >= 1 },
    { height: 'h-3', active: strength >= 2 },
    { height: 'h-4', active: strength >= 3 },
  ]

  return (
    <div className={`flex items-end gap-0.5 ${className}`} role="img" aria-label={`Signal strength: ${strength}/3`}>
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          className={`w-1 ${bar.height} rounded-sm ${
            bar.active ? 'bg-emerald-400' : 'bg-gray-600'
          }`}
          animate={bar.active ? {
            opacity: [0.5, 1, 0.5],
          } : {}}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  )
}
