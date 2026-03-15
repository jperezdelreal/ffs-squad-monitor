import React, { useState, useEffect } from 'react';
import { WelcomeModal } from './WelcomeModal';
import { ProductTour } from './ProductTour';
import { SetupChecklist } from './SetupChecklist';

const STORAGE_KEY = 'ffs-monitor-onboarding';

export function OnboardingManager() {
  const [state, setState] = useState({
    hasSeenWelcome: false,
    hasCompletedTour: false,
    hasCompletedSetup: false,
    showWelcome: false,
    showTour: false,
    showSetup: false,
  });

  useEffect(() => {
    // Check if user has completed onboarding
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setState((prev) => ({
          ...prev,
          hasSeenWelcome: data.hasSeenWelcome || false,
          hasCompletedTour: data.hasCompletedTour || false,
          hasCompletedSetup: data.hasCompletedSetup || false,
        }));
      } catch {
        // Invalid data, show onboarding
        setState((prev) => ({ ...prev, showWelcome: true }));
      }
    } else {
      // First visit - show welcome modal
      setState((prev) => ({ ...prev, showWelcome: true }));
    }
  }, []);

  const saveProgress = (updates) => {
    const newState = { ...state, ...updates };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hasSeenWelcome: newState.hasSeenWelcome,
        hasCompletedTour: newState.hasCompletedTour,
        hasCompletedSetup: newState.hasCompletedSetup,
        completedAt: new Date().toISOString(),
      })
    );
    setState(newState);
  };

  const handleTakeTour = () => {
    saveProgress({
      hasSeenWelcome: true,
      showWelcome: false,
      showSetup: true,
    });
  };

  const handleSkipWelcome = () => {
    saveProgress({
      hasSeenWelcome: true,
      showWelcome: false,
      showSetup: true,
    });
  };

  const handleSetupComplete = () => {
    saveProgress({
      hasCompletedSetup: true,
      showSetup: false,
      showTour: true,
    });
  };

  const handleTourComplete = () => {
    saveProgress({
      hasCompletedTour: true,
      showTour: false,
    });
  };

  const handleTourSkip = () => {
    saveProgress({
      hasCompletedTour: true,
      showTour: false,
    });
  };

  // Public API for restarting tour
  useEffect(() => {
    window.restartProductTour = () => {
      setState((prev) => ({
        ...prev,
        showTour: true,
      }));
    };

    return () => {
      delete window.restartProductTour;
    };
  }, []);

  return (
    <>
      <WelcomeModal
        isOpen={state.showWelcome}
        onTakeTour={handleTakeTour}
        onSkip={handleSkipWelcome}
      />

      {state.showSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <SetupChecklist onComplete={handleSetupComplete} />
        </div>
      )}

      <ProductTour
        isActive={state.showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />
    </>
  );
}
