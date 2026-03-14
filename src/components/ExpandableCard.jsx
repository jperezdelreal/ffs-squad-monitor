import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

export function ExpandableCard({ 
  title, 
  preview, 
  children, 
  defaultExpanded = false,
  className = '',
  headerClassName = '',
  contentClassName = '',
  icon,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <motion.div
      layout
      className={`glass-lg depth-floating rounded-xl border border-white/10 overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <motion.button
        layout="position"
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors ${headerClassName}`}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-0.5">{title}</h3>
            {!expanded && preview && (
              <p className="text-xs text-gray-400 truncate">{preview}</p>
            )}
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400 flex-shrink-0"
        >
          <ChevronDownIcon className="w-5 h-5" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <motion.div 
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              exit={{ y: -10 }}
              className={`px-4 pb-4 border-t border-white/5 pt-3 ${contentClassName}`}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ExpandableSection({ 
  title, 
  children, 
  defaultExpanded = true,
  count,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left group py-1"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-500 group-hover:text-gray-400"
          >
            <ChevronUpIcon className="w-4 h-4 rotate-90" />
          </motion.div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-300">
            {title}
            {count !== undefined && (
              <span className="ml-2 text-cyan-400 font-mono">({count})</span>
            )}
          </h3>
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
