import React from 'react';
import { motion } from 'framer-motion';
import { springPresets } from '../lib/motion';

const MOBILE_NAV_ITEMS = [
  { id: 'activity', icon: '📊', label: 'Activity' },
  { id: 'pipeline', icon: '🔄', label: 'Pipeline' },
  { id: 'team', icon: '👥', label: 'Team' },
  { id: 'charts', icon: '📈', label: 'Charts' },
];

export function MobileBottomNav({ activeView, onViewChange }) {
  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={springPresets.snappy}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-lg border-t border-white/10 backdrop-blur-xl safe-area-bottom"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              whileTap={{ scale: 0.9 }}
              transition={springPresets.snappy}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg min-h-[56px] relative transition-all ${
                isActive
                  ? 'text-cyan-400'
                  : 'text-gray-400'
              }`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-lg"
                  transition={springPresets.default}
                />
              )}
              <motion.span 
                className="text-2xl relative z-10"
                animate={{ 
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -2 : 0
                }}
                transition={springPresets.bouncy}
              >
                {item.icon}
              </motion.span>
              <span className={`text-[10px] font-medium mt-1 relative z-10 transition-all ${
                isActive ? 'opacity-100' : 'opacity-60'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                  layoutId="mobile-nav-active-bar"
                  transition={springPresets.default}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
