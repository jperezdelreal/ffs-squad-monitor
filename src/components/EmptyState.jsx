import React from 'react';
import { motion } from 'framer-motion';
import { fadeIn, springPresets } from '../lib/motion';

export function EmptyState({ 
  icon, 
  title, 
  message, 
  action, 
  actionLabel = 'Refresh',
  className = '' 
}) {
  return (
    <motion.div 
      {...fadeIn}
      transition={springPresets.gentle}
      className={`glass rounded-xl border border-white/10 p-8 sm:p-12 ${className}`}
    >
      <div className="text-center max-w-md mx-auto">
        {/* Icon/Illustration */}
        {icon && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, ...springPresets.bouncy }}
            className="mb-6"
          >
            {typeof icon === 'string' ? (
              <div className="text-6xl sm:text-7xl">{icon}</div>
            ) : (
              icon
            )}
          </motion.div>
        )}

        {/* Title */}
        {title && (
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...springPresets.default }}
            className="text-lg sm:text-xl font-semibold text-white mb-2"
          >
            {title}
          </motion.h3>
        )}

        {/* Message */}
        {message && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...springPresets.default }}
            className="text-sm sm:text-base text-gray-400 mb-6"
          >
            {message}
          </motion.p>
        )}

        {/* Action Button */}
        {action && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, ...springPresets.snappy }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={action}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2 mx-auto min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {actionLabel}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// SVG Illustrations
export const EmptyStateIllustrations = {
  IdleDashboard: () => (
    <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none">
      {/* Monitor frame */}
      <rect x="10" y="20" width="80" height="50" rx="4" stroke="currentColor" strokeWidth="2" className="text-gray-600" />
      {/* Monitor stand */}
      <path d="M40 70 L40 75 L60 75 L60 70" stroke="currentColor" strokeWidth="2" className="text-gray-600" />
      <line x1="30" y1="75" x2="70" y2="75" stroke="currentColor" strokeWidth="2" className="text-gray-600" />
      {/* Sleeping Z's */}
      <motion.text 
        x="50" 
        y="40" 
        fontSize="20" 
        fill="currentColor" 
        className="text-cyan-500"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: [0, 1, 1, 0], y: [5, -5, -5, -15] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
      >
        z
      </motion.text>
      <motion.text 
        x="58" 
        y="35" 
        fontSize="16" 
        fill="currentColor" 
        className="text-cyan-400"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: [0, 1, 1, 0], y: [5, -5, -5, -15] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5, delay: 0.3 }}
      >
        z
      </motion.text>
      <motion.text 
        x="65" 
        y="30" 
        fontSize="12" 
        fill="currentColor" 
        className="text-cyan-300"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: [0, 1, 1, 0], y: [5, -5, -5, -15] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5, delay: 0.6 }}
      >
        z
      </motion.text>
    </svg>
  ),

  NoAgents: () => (
    <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none">
      {/* Empty box */}
      <rect x="20" y="30" width="60" height="40" rx="4" stroke="currentColor" strokeWidth="2" className="text-gray-600" strokeDasharray="4 4" />
      {/* Question mark */}
      <motion.text 
        x="50" 
        y="60" 
        fontSize="32" 
        fill="currentColor" 
        className="text-gray-500"
        textAnchor="middle"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ?
      </motion.text>
    </svg>
  ),

  NotEnoughData: () => (
    <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none">
      {/* Chart bars - incomplete */}
      <rect x="20" y="60" width="12" height="20" rx="2" fill="currentColor" className="text-cyan-500/30" />
      <rect x="38" y="55" width="12" height="25" rx="2" fill="currentColor" className="text-cyan-500/30" />
      <rect x="56" y="65" width="12" height="15" rx="2" fill="currentColor" className="text-cyan-500/30" />
      {/* Dotted placeholder bars */}
      <rect x="74" y="50" width="12" height="30" rx="2" stroke="currentColor" strokeWidth="2" className="text-gray-600" strokeDasharray="2 2" />
      {/* Clock icon */}
      <motion.circle 
        cx="80" 
        cy="30" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="2" 
        className="text-gray-500"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '80px', originY: '30px' }}
      />
      <line x1="80" y1="30" x2="80" y2="24" stroke="currentColor" strokeWidth="2" className="text-gray-500" />
      <line x1="80" y1="30" x2="84" y2="32" stroke="currentColor" strokeWidth="2" className="text-gray-500" />
    </svg>
  ),

  Disconnected: () => (
    <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none">
      {/* Broken connection */}
      <circle cx="30" cy="50" r="8" fill="currentColor" className="text-gray-500" />
      <circle cx="70" cy="50" r="8" fill="currentColor" className="text-gray-500" />
      <motion.line 
        x1="38" 
        y1="50" 
        x2="48" 
        y2="50" 
        stroke="currentColor" 
        strokeWidth="3" 
        className="text-gray-500"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.line 
        x1="52" 
        y1="50" 
        x2="62" 
        y2="50" 
        stroke="currentColor" 
        strokeWidth="3" 
        className="text-gray-500"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {/* Warning indicator */}
      <motion.path
        d="M50 35 L55 45 L45 45 Z"
        fill="currentColor"
        className="text-yellow-500"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{ originX: '50px', originY: '40px' }}
      />
      <text x="50" y="44" fontSize="8" fill="black" textAnchor="middle">!</text>
    </svg>
  ),
};
