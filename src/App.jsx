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
import { Analytics } from './components/Analytics';
import { TimelineSwimlane } from './components/TimelineSwimlane';
import { Settings } from './components/Settings';
import { NotificationHistory } from './components/NotificationHistory';
import { usePolling } from './hooks/usePolling';
import { useHealthScore } from './hooks/useHealthScore';
import { useSSE } from './hooks/useSSE';
import { useNotifications } from './hooks/useNotifications';

function App() {
  const [activeView, setActiveView] = useState('activity');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lastUpdate, isConnected } = usePolling();
  const { score, level, breakdown, staleness, heartbeatAgeMs } = useHealthScore();
  const { status: sseStatus, reconnect: sseReconnect } = useSSE({
    channels: ['heartbeat', 'events', 'issues', 'usage'],
  });
  useNotifications();

  const handleViewChange = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (activeView) {
      case 'activity':
        return <ActivityFeed />;
      case 'pipeline':
        return <PipelineVisualizer />;
      case 'team':
        return <TeamBoard />;
      case 'timeline':
        return <TimelineSwimlane />;
      case 'charts':
        return <TrendCharts />;
      case 'cost':
        return <CostTracker />;
      case 'analytics':
        return <Analytics />;
      default:
        return <ActivityFeed />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0a0e14] overflow-hidden">
        {/* Skip to content link for screen readers */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Skip to main content
        </a>
        
        {/* Subtle gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />
        
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        <Sidebar 
          activeView={activeView} 
          onViewChange={handleViewChange}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <Header
            lastUpdate={lastUpdate}
            isConnected={isConnected}
            healthScore={score}
            healthLevel={level}
            healthBreakdown={breakdown}
            sseStatus={sseStatus}
            onSSEReconnect={sseReconnect}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <StalenessAlert staleness={staleness} heartbeatAgeMs={heartbeatAgeMs} />
          <main id="main-content" className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
            {renderView()}
          </main>
        </div>
        <Settings />
        <NotificationHistory />
      </div>
    </ErrorBoundary>
  );
}

export default App;
