import React from 'react';

const NAV_ITEMS = [
  { id: 'activity', label: 'Activity Feed', icon: '📊' },
  { id: 'pipeline', label: 'Pipeline', icon: '🔄' },
  { id: 'team', label: 'Team Board', icon: '👥' },
  { id: 'cost', label: 'Cost Tracker', icon: '💰' },
];

export function Sidebar({ activeView, onViewChange }) {
  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-2">FFS Monitor</h2>
        <p className="text-xs text-gray-400">First Frame Studios</p>
      </div>
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeView === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
