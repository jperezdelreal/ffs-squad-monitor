import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, springPresets, buttonPress } from '../lib/motion';

export function ErrorState({ 
  title = 'Something went wrong',
  message = 'An unexpected error occurred',
  error,
  retry,
  retryLabel = 'Try Again',
  showDetails = true,
  className = '' 
}) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const handleRetry = async () => {
    if (!retry) return;
    setIsRetrying(true);
    try {
      await retry();
    } finally {
      retryTimerRef.current = setTimeout(() => setIsRetrying(false), 500);
    }
  };

  return (
    <motion.div 
      {...fadeIn}
      transition={springPresets.gentle}
      className={`glass rounded-xl border border-red-500/20 p-8 ${className}`}
    >
      <div className="text-center max-w-md mx-auto">
        {/* Error Icon with pulse */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, ...springPresets.bouncy }}
          className="mb-6"
        >
          <motion.div
            className="inline-block"
            animate={{ 
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <div className="text-5xl sm:text-6xl">⚠️</div>
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...springPresets.default }}
          className="text-lg sm:text-xl font-semibold text-white mb-2"
        >
          {title}
        </motion.h3>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ...springPresets.default }}
          className="text-sm sm:text-base text-gray-400 mb-6"
        >
          {message}
        </motion.p>

        {/* Retry Button */}
        {retry && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, ...springPresets.snappy }}
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            onClick={handleRetry}
            disabled={isRetrying}
            className={`px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2 mx-auto min-h-[44px] ${
              isRetrying ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isRetrying ? (
              <>
                <motion.svg 
                  className="w-4 h-4"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </motion.svg>
                Retrying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {retryLabel}
              </>
            )}
          </motion.button>
        )}

        {/* Error Details Expansion */}
        {showDetails && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors flex items-center gap-1 mx-auto"
            >
              <motion.svg 
                className="w-3 h-3"
                animate={{ rotate: showErrorDetails ? 180 : 0 }}
                transition={springPresets.snappy}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
              {showErrorDetails ? 'Hide' : 'Show'} details
            </button>
            
            <AnimatePresence>
              {showErrorDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={springPresets.default}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 bg-black/30 rounded-lg text-left">
                    <p className="text-xs text-red-400 font-mono break-all">
                      {typeof error === 'string' ? error : error?.message || JSON.stringify(error)}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Connection Error Banner Component (full-width, prominent)
export function ConnectionErrorBanner({ message, retry, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={springPresets.snappy}
      className="relative"
    >
      {/* Animated pulse background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 rounded-xl"
        animate={{ 
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          ease: 'linear'
        }}
        style={{ backgroundSize: '200% 200%' }}
      />
      
      <div className="relative glass rounded-xl border border-red-500/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {/* Pulsing warning icon */}
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
              }}
              className="text-2xl"
            >
              ⚠️
            </motion.div>
            
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-300 mb-1">Connection Error</h4>
              <p className="text-xs text-gray-400">{message || 'Unable to reach the backend server'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {retry && (
              <motion.button
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                onClick={retry}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-lg text-xs font-medium hover:shadow-lg hover:shadow-red-500/25 transition-all flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </motion.button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
