import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline'

const VARIANT_CONFIG = {
  success: {
    icon: CheckCircleIcon,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    progressBg: 'bg-emerald-500',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    progressBg: 'bg-amber-500',
  },
  error: {
    icon: XCircleIcon,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    iconColor: 'text-red-400',
    progressBg: 'bg-red-500',
  },
  info: {
    icon: InformationCircleIcon,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    progressBg: 'bg-blue-500',
  },
}

function Toast({ 
  id, 
  variant = 'info', 
  title, 
  message, 
  duration = 5000, 
  action,
  onDismiss,
  index,
}) {
  const [progress, setProgress] = useState(100)
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info
  const Icon = config.icon

  useEffect(() => {
    if (duration === null || duration === 0) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      
      if (remaining === 0) {
        clearInterval(interval)
        onDismiss?.(id)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [duration, id, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 400, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 400, scale: 0.8 }}
      transition={{ 
        type: 'spring', 
        damping: 25, 
        stiffness: 300,
        layout: { duration: 0.2 }
      }}
      style={{ zIndex: 1000 - index }}
      className={`
        relative w-96 max-w-full overflow-hidden rounded-xl border backdrop-blur-xl
        shadow-2xl shadow-black/40
        ${config.bg} ${config.border}
      `}
    >
      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          className={`absolute top-0 left-0 h-1 ${config.progressBg}`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      )}

      <div className="p-4 pt-5">
        <div className="flex items-start gap-3">
          <Icon className={`w-6 h-6 ${config.iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
            {message && (
              <p className="text-xs text-gray-300 leading-relaxed">{message}</p>
            )}
            {action && (
              <button
                onClick={() => {
                  action.onClick?.()
                  onDismiss?.(id)
                }}
                className="mt-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => onDismiss?.(id)}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function ToastContainer({ toasts, onDismiss, maxVisible = 3 }) {
  const visibleToasts = toasts.slice(0, maxVisible)
  const queuedCount = Math.max(0, toasts.length - maxVisible)

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast, index) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onDismiss={onDismiss} index={index} />
          </div>
        ))}
        {queuedCount > 0 && (
          <motion.div
            key="queue-indicator"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-auto bg-gray-800/90 backdrop-blur-sm border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-300 text-center shadow-lg"
          >
            +{queuedCount} more in queue
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Hook to manage toasts
export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = (toast) => {
    const id = toast.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setToasts(prev => [...prev, { ...toast, id }])
    return id
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const success = (title, message, options = {}) => 
    addToast({ variant: 'success', title, message, ...options })

  const warning = (title, message, options = {}) => 
    addToast({ variant: 'warning', title, message, ...options })

  const error = (title, message, options = {}) => 
    addToast({ variant: 'error', title, message, ...options })

  const info = (title, message, options = {}) => 
    addToast({ variant: 'info', title, message, ...options })

  return {
    toasts,
    addToast,
    removeToast,
    success,
    warning,
    error,
    info,
  }
}
