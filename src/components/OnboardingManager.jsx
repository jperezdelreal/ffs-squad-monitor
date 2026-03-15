import React, { useState, useEffect } from 'react';
import { WelcomeModal } from './WelcomeModal';
import { ProductTour } from './ProductTour';

const DISMISSED_KEY = 'ffs-onboarding-dismissed';

async function runHealthChecks() {
  const endpoints = ['/health', '/api/config', '/api/events?limit=1', '/api/issues'];
  const results = await Promise.all(
    endpoints.map((url) =>
      fetch(url).then((r) => r.ok).catch(() => false)
    )
  );
  return results.every(Boolean);
}

export function OnboardingManager() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    runHealthChecks().then((allPassed) => {
      if (allPassed) {
        // Everything works — skip onboarding entirely
        localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
      } else {
        setShowWelcome(true);
      }
    });
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    setShowWelcome(false);
  };

  // Public API for restarting tour
  useEffect(() => {
    window.restartProductTour = () => setShowTour(true);
    return () => { delete window.restartProductTour; };
  }, []);

  return (
    <>
      <WelcomeModal isOpen={showWelcome} onSkip={dismiss} />
      <ProductTour
        isActive={showTour}
        onComplete={() => setShowTour(false)}
        onSkip={() => setShowTour(false)}
      />
    </>
  );
}
