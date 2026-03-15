import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springPresets } from '../lib/motion';

export function WelcomeModal({ isOpen, onSkip }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            onClick={onSkip}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={springPresets.bouncy}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="glass rounded-2xl border border-white/10 max-w-2xl w-full p-8 sm:p-12 shadow-2xl">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-8"
              >
                <div className="text-6xl mb-4">🚀</div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Welcome to Squad Monitor
                </h2>
                <p className="text-gray-400 text-base sm:text-lg">
                  Your command center for AI squad operations
                </p>
              </motion.div>

              {/* Features Grid */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
              >
                <FeatureCard
                  icon="📊"
                  title="Real-Time Analytics"
                  description="Track squad performance and metrics live"
                  delay={0.3}
                />
                <FeatureCard
                  icon="🎯"
                  title="Smart Filtering"
                  description="Press ⌘K / Ctrl+K for command palette"
                  delay={0.35}
                />
                <FeatureCard
                  icon="⚡"
                  title="Live Streaming"
                  description="SSE-powered instant updates"
                  delay={0.4}
                />
                <FeatureCard
                  icon="⌨️"
                  title="Keyboard Shortcuts"
                  description="Press ? to view all shortcuts"
                  delay={0.45}
                />
              </motion.div>

              {/* Single dismiss button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSkip}
                  data-testid="onboarding-dismiss"
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-base font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all min-h-[52px]"
                >
                  Get Started
                </motion.button>
              </motion.div>

              {/* Hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center text-xs text-gray-500 mt-4"
              >
                You can take a guided tour anytime from the Help menu
              </motion.p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FeatureCard({ icon, title, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-400">{description}</p>
    </motion.div>
  );
}
