import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { springPresets } from '../lib/motion';

export function SetupChecklist({ onComplete }) {
  const [checks, setChecks] = useState([
    {
      id: 'backend',
      label: 'Backend Connection',
      status: 'checking',
      description: 'Verifying Express server connection',
    },
    {
      id: 'github',
      label: 'GitHub Integration',
      status: 'checking',
      description: 'Checking GitHub API access',
    },
    {
      id: 'sse',
      label: 'Real-Time Streaming',
      status: 'checking',
      description: 'Testing SSE connection',
    },
    {
      id: 'data',
      label: 'Initial Data Load',
      status: 'pending',
      description: 'Loading squad data',
    },
  ]);

  useEffect(() => {
    runHealthChecks();
  }, []);

  const runHealthChecks = async () => {
    // Check backend connection
    try {
      const healthResponse = await fetch('/health');
      if (healthResponse.ok) {
        updateCheckStatus('backend', 'success');
      } else {
        updateCheckStatus('backend', 'error');
      }
    } catch {
      updateCheckStatus('backend', 'error');
    }

    // Small delay for visual effect
    await sleep(300);

    // Check GitHub API
    try {
      const configResponse = await fetch('/api/config');
      if (configResponse.ok) {
        updateCheckStatus('github', 'success');
      } else {
        updateCheckStatus('github', 'error');
      }
    } catch {
      updateCheckStatus('github', 'error');
    }

    await sleep(300);

    // Check SSE (simplified check)
    try {
      const eventsResponse = await fetch('/api/events?limit=1');
      if (eventsResponse.ok) {
        updateCheckStatus('sse', 'success');
      } else {
        updateCheckStatus('sse', 'error');
      }
    } catch {
      updateCheckStatus('sse', 'error');
    }

    await sleep(300);

    // Check initial data
    try {
      const issuesResponse = await fetch('/api/issues');
      if (issuesResponse.ok) {
        updateCheckStatus('data', 'success');
      } else {
        updateCheckStatus('data', 'error');
      }
    } catch {
      updateCheckStatus('data', 'error');
    }

    // Auto-complete if all passed
    await sleep(500);
    const allPassed = checks.every((check) =>
      ['success', 'checking'].includes(check.status)
    );
    if (allPassed && onComplete) {
      onComplete();
    }
  };

  const updateCheckStatus = (id, status) => {
    setChecks((prev) =>
      prev.map((check) => (check.id === id ? { ...check, status } : check))
    );
  };

  const retryChecks = () => {
    setChecks((prev) =>
      prev.map((check) => ({ ...check, status: 'checking' }))
    );
    runHealthChecks();
  };

  const hasErrors = checks.some((check) => check.status === 'error');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springPresets.default}
      className="glass rounded-xl border border-white/10 p-6 max-w-lg mx-auto"
    >
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">⚙️</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Setting Up Your Dashboard
        </h3>
        <p className="text-sm text-gray-400">
          Running health checks to ensure everything is ready...
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {checks.map((check, index) => (
          <CheckItem key={check.id} check={check} delay={index * 0.1} />
        ))}
      </div>

      {hasErrors && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4"
        >
          <p className="text-sm text-red-300 mb-2">
            ⚠️ Some checks failed. This might affect functionality.
          </p>
          <ul className="text-xs text-red-400 space-y-1 mb-3">
            <li>• Ensure the backend server is running</li>
            <li>• Check your GitHub token configuration</li>
            <li>• Verify network connectivity</li>
          </ul>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={retryChecks}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-all border border-red-500/30"
          >
            Retry Checks
          </motion.button>
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onComplete}
        className="w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
      >
        {hasErrors ? 'Continue Anyway' : 'All Set! Continue'}
      </motion.button>
    </motion.div>
  );
}

function CheckItem({ check, delay }) {
  const statusConfig = {
    checking: {
      icon: ClockIcon,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30',
    },
    success: {
      icon: CheckCircleIcon,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    error: {
      icon: XCircleIcon,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    },
    pending: {
      icon: ClockIcon,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/5',
      borderColor: 'border-gray-500/20',
    },
  };

  const config = statusConfig[check.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, ...springPresets.default }}
      className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor} transition-all`}
    >
      <motion.div
        animate={
          check.status === 'checking'
            ? { rotate: 360 }
            : { rotate: 0 }
        }
        transition={{
          duration: 1,
          repeat: check.status === 'checking' ? Infinity : 0,
          ease: 'linear',
        }}
      >
        <Icon className={`w-5 h-5 ${config.color}`} />
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.color}`}>{check.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{check.description}</p>
      </div>
    </motion.div>
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
