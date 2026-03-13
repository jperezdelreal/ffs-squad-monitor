import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ActivityFeed } from './components/ActivityFeed';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { TeamBoard } from './components/TeamBoard';
import { CostTracker } from './components/CostTracker';
import { usePolling } from './hooks/usePolling';

function App() {
  const [activeView, setActiveView] = useState('activity');
  const { lastUpdate, isConnected } = usePolling();

  const renderView = () => {
    switch (activeView) {
      case 'activity':
        return <ActivityFeed />;
      case 'pipeline':
        return <PipelineVisualizer />;
      case 'team':
        return <TeamBoard />;
      case 'cost':
        return <CostTracker />;
      default:
        return <ActivityFeed />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0e14] overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />
      
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header lastUpdate={lastUpdate} isConnected={isConnected} />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;
