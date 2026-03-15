import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springPresets } from '../lib/motion';

export const tourSteps = [
  {
    id: 'header',
    title: 'Dashboard Header',
    description: 'Monitor connection status, health score, and access quick actions. Toggle dark/light theme here.',
    selector: 'header',
    position: 'bottom',
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    description: 'Switch between views: Activity Feed, Pipeline, Team Board, Timeline, Charts, Cost Tracker, and Analytics.',
    selector: 'nav[aria-label="Main navigation"]',
    position: 'right',
  },
  {
    id: 'activity',
    title: 'Activity Feed',
    description: 'Real-time stream of squad events, issues, and updates. Filter by agent, type, or keywords.',
    selector: 'main',
    position: 'center',
  },
  {
    id: 'command-palette',
    title: 'Command Palette',
    description: 'Press ⌘K (Mac) or Ctrl+K (Windows) to open the command palette for quick navigation and actions.',
    selector: 'body',
    position: 'center',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Press ? to view all keyboard shortcuts. Use number keys 1-7 to switch views, R to refresh, and F for focus mode.',
    selector: 'body',
    position: 'center',
  },
];

export function ProductTour({ isActive, onComplete, onSkip, startStep = 0 }) {
  const [currentStep, setCurrentStep] = useState(startStep);
  const [spotlightPosition, setSpotlightPosition] = useState(null);

  const step = tourSteps[currentStep];

  const calculateSpotlight = useCallback(() => {
    if (!step) return null;

    const element = document.querySelector(step.selector);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }, [step]);

  useEffect(() => {
    if (isActive && step) {
      const position = calculateSpotlight();
      setSpotlightPosition(position);

      const handleResize = () => {
        const newPosition = calculateSpotlight();
        setSpotlightPosition(newPosition);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isActive, step, calculateSpotlight]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (!isActive) return;

      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      }
    },
    [isActive, currentStep, onSkip]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isActive || !step) return null;

  const tooltipPosition = getTooltipPosition(spotlightPosition, step.position);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Spotlight Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-auto"
          style={{
            background: spotlightPosition
              ? `radial-gradient(circle at ${spotlightPosition.left + spotlightPosition.width / 2}px ${
                  spotlightPosition.top + spotlightPosition.height / 2
                }px, transparent ${Math.max(spotlightPosition.width, spotlightPosition.height) / 2 + 20}px, rgba(0,0,0,0.85) ${
                  Math.max(spotlightPosition.width, spotlightPosition.height) / 2 + 100
                }px)`
              : 'rgba(0,0,0,0.85)',
          }}
          onClick={onSkip}
        />

        {/* Spotlight Ring */}
        {spotlightPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springPresets.bouncy}
            className="absolute pointer-events-none"
            style={{
              top: spotlightPosition.top - 8,
              left: spotlightPosition.left - 8,
              width: spotlightPosition.width + 16,
              height: spotlightPosition.height + 16,
              border: '3px solid',
              borderImage: 'linear-gradient(135deg, #06b6d4, #3b82f6) 1',
              borderRadius: '12px',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.5)',
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={springPresets.snappy}
          className="absolute pointer-events-auto glass rounded-xl border border-white/10 p-6 max-w-md shadow-2xl"
          style={tooltipPosition}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Dots */}
          <div className="flex gap-1.5 mb-4">
            {tourSteps.map((_, index) => (
              <motion.div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 w-8'
                    : index < currentStep
                    ? 'bg-cyan-500/50 w-1.5'
                    : 'bg-white/20 w-1.5'
                }`}
                whileHover={{ scale: 1.2 }}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
          <p className="text-sm text-gray-300 mb-6">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onSkip}
              className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              Skip Tour
            </button>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePrevious}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium border border-white/10 transition-all"
                >
                  Previous
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
              </motion.button>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-white/10 text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">→</kbd>
            <span>to navigate</span>
            <span>•</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Esc</kbd>
            <span>to skip</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function getTooltipPosition(spotlight, position) {
  if (!spotlight) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const padding = 20;

  switch (position) {
    case 'bottom':
      return {
        top: spotlight.top + spotlight.height + padding,
        left: spotlight.left + spotlight.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'top':
      return {
        bottom: window.innerHeight - spotlight.top + padding,
        left: spotlight.left + spotlight.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'right':
      return {
        top: spotlight.top + spotlight.height / 2,
        left: spotlight.left + spotlight.width + padding,
        transform: 'translateY(-50%)',
      };
    case 'left':
      return {
        top: spotlight.top + spotlight.height / 2,
        right: window.innerWidth - spotlight.left + padding,
        transform: 'translateY(-50%)',
      };
    case 'center':
    default:
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
  }
}
