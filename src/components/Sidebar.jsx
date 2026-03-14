import React from 'react';

const NAV_ITEMS = [
  { id: 'activity', label: 'Activity Feed', icon: '📊', color: 'cyan' },
  { id: 'pipeline', label: 'Pipeline', icon: '🔄', color: 'purple' },
  { id: 'team', label: 'Team Board', icon: '👥', color: 'blue' },
  { id: 'charts', label: 'Trend Charts', icon: '📈', color: 'emerald' },
  { id: 'cost', label: 'Cost Tracker', icon: '💰', color: 'green' },
  { id: 'analytics', label: 'Analytics', icon: '📉', color: 'amber', badge: 'NEW' },
];

export function Sidebar({ activeView, onViewChange }) {
  return (
    <aside className="w-72 glass border-r border-white/10 backdrop-blur-xl flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl">
            🎬
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">FFS Monitor</h2>
            <p className="text-xs text-gray-400">First Frame Studios</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-r-full" />
              )}
              <span className="text-2xl transition-transform group-hover:scale-110">{item.icon}</span>
              <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 uppercase tracking-wide">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-gray-500 text-center font-mono">
          v1.0.0 • Made with ❤️
        </div>
      </div>
    </aside>
  );
}
