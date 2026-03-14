import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { StalenessAlert } from './components/StalenessAlert';
import { ActivityFeed } from './components/ActivityFeed';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { TeamBoard } from './components/TeamBoard';
import { CostTracker } from './components/CostTracker';
import { TrendCharts } from './components/TrendCharts';
import { usePolling } from './hooks/usePolling';
import { useHealthScore } from './hooks/useHealthScore';

function App() {
  const [activeView, setActiveView] = useState('activity');
  const { lastUpdate, isConnected } = usePolling();
  const { score, level, breakdown, staleness, heartbeatAgeMs } = useHealthScore();

  const renderView = () => {
    switch (activeView) {
      case 'activity':
        return <ActivityFeed />;
      case 'pipeline':
        return <PipelineVisualizer />;
      case 'team':
        return <TeamBoard />;
      case 'charts':
        return <TrendCharts />;
      case 'cost':
        return <CostTracker />;
      default:
        return <ActivityFeed />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0a0e14] overflow-hidden">
        {/* Subtle gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />
        
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <Header
            lastUpdate={lastUpdate}
            isConnected={isConnected}
            healthScore={score}
            healthLevel={level}
            healthBreakdown={breakdown}
          />
          <StalenessAlert staleness={staleness} heartbeatAgeMs={heartbeatAgeMs} />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {renderView()}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
