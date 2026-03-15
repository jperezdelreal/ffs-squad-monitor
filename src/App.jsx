import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { StalenessAlert } from './components/StalenessAlert';
import { ActivityFeed } from './components/ActivityFeed';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { TeamBoard } from './components/TeamBoard';
import { CostTracker } from './components/CostTracker';
import { TimelineSwimlane } from './components/TimelineSwimlane';
import { Settings } from './components/Settings';
import { NotificationHistory } from './components/NotificationHistory';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ToastContainer, useToast } from './components/Toast';
import { SkeletonChart } from './components/Skeleton';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { usePolling } from './hooks/usePolling';
import { useHealthScore } from './hooks/useHealthScore';
import { useSSE } from './hooks/useSSE';
import { useNotifications } from './hooks/useNotifications';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { useStore } from './store/store';
import { fadeIn, springPresets } from './lib/motion';

// Lazy load heavy components with Chart.js
const Analytics = lazy(() => import('./components/Analytics'));
const TrendCharts = lazy(() => import('./components/TrendCharts'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));

function App() {
  const [activeView, setActiveView] = useState('activity');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const exportButtonRef = useRef(null);
  
  const { toasts, removeToast, success, error, info } = useToast();
  
  const { lastUpdate, isConnected } = usePolling();
  const { score, level, breakdown, staleness, heartbeatAgeMs } = useHealthScore();
  const { status: sseStatus, reconnect: sseReconnect } = useSSE({
    channels: ['heartbeat', 'events', 'issues', 'usage'],
  });
  useNotifications();

  const focusMode = useStore((state) => state.focusMode)
  const density = useStore((state) => state.density)
  const showShortcutsPanel = useStore((state) => state.showShortcutsPanel)
  const showSettingsPanel = useStore((state) => state.showSettingsPanel)
  const showNotificationPanel = useStore((state) => state.showNotificationPanel)
  const toggleShortcutsPanel = useStore((state) => state.toggleShortcutsPanel)
  const toggleSettingsPanel = useStore((state) => state.toggleSettingsPanel)
  const toggleFocusMode = useStore((state) => state.toggleFocusMode)
  const refreshAll = useStore((state) => state.refreshAll)

  // Cmd+K / Ctrl+K handler for command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
      // F key for focus mode
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          return // Don't trigger in input fields
        }
        e.preventDefault()
        toggleFocusMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode])

  const { shortcuts } = useKeyboardShortcuts({
    onViewChange: (view) => {
      setActiveView(view)
      setSidebarOpen(false)
    },
    onRefresh: refreshAll,
    onOpenExport: () => {
      if (exportButtonRef.current) {
        exportButtonRef.current.click()
      }
    },
    onToggleShortcuts: toggleShortcutsPanel,
    shortcutsOpen: showShortcutsPanel,
    settingsOpen: showSettingsPanel,
    notificationsOpen: showNotificationPanel,
  })

  const handleViewChange = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  const handleToggleTheme = () => {
    document.documentElement.classList.toggle('light')
  };

  // Demo toast on refresh (optional - can be removed or customized)
  const handleRefresh = async () => {
    await refreshAll()
    success('Dashboard refreshed', 'All data updated successfully')
  }

  // Density classes mapping
  const densityClasses = {
    compact: 'space-y-2',
    comfortable: 'space-y-3 sm:space-y-4 md:space-y-6',
    spacious: 'space-y-6 sm:space-y-8 md:space-y-10',
  }

  const densityPadding = {
    compact: 'p-2 sm:p-3 md:p-4',
    comfortable: 'p-3 sm:p-4 md:p-6',
    spacious: 'p-4 sm:p-6 md:p-8',
  }
  // Swipe gesture support for mobile sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (window.innerWidth < 1024 && !sidebarOpen) {
        setSidebarOpen(true);
      }
    },
    onSwipeLeft: () => {
      if (window.innerWidth < 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    },
    threshold: 75,
    enabled: true,
  });

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
        return (
          <Suspense fallback={<SkeletonChart count={3} />}>
            <TrendCharts />
          </Suspense>
        );
      case 'cost':
        return <CostTracker />;
      case 'analytics':
        return (
          <Suspense fallback={<SkeletonChart count={4} />}>
            <Analytics />
          </Suspense>
        );
      default:
        return <ActivityFeed />;
    }
  };

  return (
    <ErrorBoundary>
      <OnboardingManager />
      <div className={`flex h-screen bg-[#0a0e14] dark:bg-[#0a0e14] light:bg-ops-light-bg overflow-hidden ${density === 'compact' ? 'text-sm' : ''}`}>
        {/* Skip to content link for screen readers */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Skip to main content
        </a>
        
        {/* Subtle gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 dark:from-cyan-500/5 dark:to-blue-600/5 light:from-cyan-500/10 light:to-blue-600/10 pointer-events-none" />
        
        {/* Mobile overlay */}
        {sidebarOpen && !focusMode && (
          <div 
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {!focusMode && (
          <Sidebar 
            activeView={activeView} 
            onViewChange={handleViewChange}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          {!focusMode && (
            <Header
              lastUpdate={lastUpdate}
              isConnected={isConnected}
              healthScore={score}
              healthLevel={level}
              healthBreakdown={breakdown}
              sseStatus={sseStatus}
              onSSEReconnect={sseReconnect}
              onMenuClick={() => setSidebarOpen(true)}
              exportButtonRef={exportButtonRef}
            />
          )}
          {!focusMode && <StalenessAlert staleness={staleness} heartbeatAgeMs={heartbeatAgeMs} />}
          
          {/* Focus mode toggle button */}
          <motion.button
            onClick={toggleFocusMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed top-4 right-20 z-50 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium transition-all shadow-lg backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Toggle Focus Mode (F)"
          >
            {focusMode ? '👁️ Exit Focus' : '🎯 Focus'}
          </motion.button>

          <main 
            id="main-content" 
            className={`flex-1 overflow-y-auto ${densityPadding[density]} ${focusMode ? 'pb-6' : 'pb-20 md:pb-6'} ${densityClasses[density]} scroll-smooth snap-y snap-proximity`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                variants={fadeIn}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={springPresets.default}
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        {!focusMode && <MobileBottomNav activeView={activeView} onViewChange={handleViewChange} />}
        <Settings />
        <NotificationHistory />
        <ShortcutsOverlay 
          isOpen={showShortcutsPanel}
          onClose={toggleShortcutsPanel}
          shortcuts={shortcuts}
        />
        {commandPaletteOpen && (
          <Suspense fallback={null}>
            <CommandPalette
              isOpen={commandPaletteOpen}
              onClose={() => setCommandPaletteOpen(false)}
              onViewChange={handleViewChange}
              onRefresh={handleRefresh}
              onToggleTheme={handleToggleTheme}
              onOpenSettings={toggleSettingsPanel}
              onOpenShortcuts={toggleShortcutsPanel}
              onOpenExport={() => {
                if (exportButtonRef.current) {
                  exportButtonRef.current.click()
                }
              }}
            />
          </Suspense>
        )}
        <ToastContainer toasts={toasts} onDismiss={removeToast} maxVisible={3} />
        <PWAInstallPrompt />
      </div>
    </ErrorBoundary>
  );
}

export default App;
