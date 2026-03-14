import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/store';
import { slideInLeft, springPresets } from '../lib/motion';

const NAV_ITEMS = [
  { id: 'activity', label: 'Activity Feed', icon: '📊', color: 'cyan' },
  { id: 'pipeline', label: 'Pipeline', icon: '🔄', color: 'purple' },
  { id: 'team', label: 'Team Board', icon: '👥', color: 'blue' },
  { id: 'timeline', label: 'Timeline', icon: '🎬', color: 'indigo', badge: 'NEW' },
  { id: 'charts', label: 'Trend Charts', icon: '📈', color: 'emerald' },
  { id: 'cost', label: 'Cost Tracker', icon: '💰', color: 'green' },
  { id: 'analytics', label: 'Analytics', icon: '📉', color: 'amber' },
];

export function Sidebar({ activeView, onViewChange, isOpen, onClose }) {
  const toggleSettingsPanel = useStore(s => s.toggleSettingsPanel);
  const showSettingsPanel = useStore(s => s.showSettingsPanel);

  return (
    <motion.aside
      initial={false}
      animate={{ x: isOpen ? 0 : '-100%' }}
      transition={springPresets.snappy}
      className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 glass border-r border-white/10 dark:border-white/10 light:border-black/10 backdrop-blur-xl flex flex-col
        ${!isOpen ? 'lg:translate-x-0' : ''}
      `}
      style={{ x: '0%' }}
    >
      <div className="p-4 sm:p-6 border-b border-white/10 dark:border-white/10 light:border-black/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl">
            🎬
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white dark:text-white light:text-gray-900">FFS Monitor</h2>
            <p className="text-xs text-gray-400 dark:text-gray-400 light:text-gray-500 truncate">First Frame Studios</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <nav className="flex-1 p-3 sm:p-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springPresets.snappy}
              className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg group relative min-h-[44px] ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white dark:text-white light:text-gray-900 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 border border-transparent'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-r-full"
                  transition={springPresets.default}
                />
              )}
              <motion.span 
                className="text-xl sm:text-2xl"
                whileHover={{ scale: 1.2, rotate: 5 }}
                transition={springPresets.bouncy}
              >
                {item.icon}
              </motion.span>
              <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
              {item.badge && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={springPresets.bouncy}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 uppercase tracking-wide"
                >
                  {item.badge}
                </motion.span>
              )}
              {isActive && (
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>
      <div className="p-3 sm:p-4 border-t border-white/10 dark:border-white/10 light:border-black/10 space-y-3">
        <motion.button
          onClick={toggleSettingsPanel}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={springPresets.snappy}
          className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-lg group min-h-[44px] ${
            showSettingsPanel
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white dark:text-white light:text-gray-900 border border-cyan-500/30'
              : 'text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 border border-transparent'
          }`}
          aria-label="Settings"
        >
          <motion.span 
            className="text-lg sm:text-xl"
            whileHover={{ rotate: 180 }}
            transition={springPresets.default}
          >
            ⚙️
          </motion.span>
          <span className="text-sm font-medium">Settings</span>
        </motion.button>
        <div className="text-xs text-gray-500 dark:text-gray-500 light:text-gray-400 text-center font-mono">
          v1.0.0 • Made with ❤️
        </div>
      </div>
    </motion.aside>
  );
}
