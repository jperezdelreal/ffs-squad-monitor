import React from 'react';

export function ActivityFeed() {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-white mb-2">Activity Feed</h2>
        <p className="text-gray-400">Coming soon in C4</p>
        <p className="text-sm text-gray-500 mt-4">
          Real-time feed of squad activity, commits, PRs, and deployments
        </p>
      </div>
    </div>
  );
}
