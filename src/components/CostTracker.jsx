import React, { useState, useEffect } from 'react';
import { fetchWorkflowRuns } from '../services/github';
import { getCostHistory, getCIMinutesUsage } from '../services/mockData';

export function CostTracker() {
  const [costHistory] = useState(getCostHistory());
  const [ciUsage, setCiUsage] = useState(getCIMinutesUsage());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCIUsage();
  }, []);

  const loadCIUsage = async () => {
    setLoading(true);
    try {
      const usage = getCIMinutesUsage();
      setCiUsage(usage);
    } catch (error) {
      console.error('Failed to load CI usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentSpend = 0;
  const azureSavings = 120;
  const awsSavings = 200;

  const isApproachingLimit = ciUsage.percentage > 80;

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">
          Loading cost data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">Cost Tracker</h2>
        
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-green-500 mb-2">€{currentSpend}</div>
          <div className="text-lg text-gray-400">Current Monthly Spend</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">vs. Azure ACI</span>
              <span className="text-xl">☁️</span>
            </div>
            <div className="text-2xl font-bold text-green-500">€{azureSavings}/mo</div>
            <div className="text-xs text-gray-400 mt-1">saved</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">vs. AWS</span>
              <span className="text-xl">🚀</span>
            </div>
            <div className="text-2xl font-bold text-green-500">€{awsSavings}/mo</div>
            <div className="text-xs text-gray-400 mt-1">saved</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Budget vs Actual (Last 30 Days)</h3>
        <div className="h-48 flex items-end gap-1">
          {costHistory.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex flex-col justify-end" style={{ height: '100%' }}>
                <div
                  className="w-full bg-gray-600 rounded-t"
                  style={{ height: '4px' }}
                  title={`Budget: €${day.budget.toFixed(2)}`}
                />
                <div
                  className="w-full bg-green-500 rounded-t"
                  style={{ height: '8px' }}
                  title={`Actual: €${day.actual}`}
                />
              </div>
              {index % 5 === 0 && (
                <div className="text-xs text-gray-500 rotate-45 origin-left mt-4">
                  {new Date(day.date).getDate()}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-600 rounded"></div>
            <span className="text-sm text-gray-400">Budget (€500/mo)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-400">Actual (€0)</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Resource Breakdown</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">GitHub Actions Minutes</span>
              <span className="text-sm font-medium text-white">
                {ciUsage.used} / {ciUsage.total} minutes
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isApproachingLimit ? 'bg-yellow-500' : 'bg-blue-600'
                }`}
                style={{ width: `${ciUsage.percentage}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{ciUsage.percentage}% used</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="text-sm text-gray-400 mb-1">Storage</div>
              <div className="text-xl font-bold text-white">€0</div>
              <div className="text-xs text-gray-500 mt-1">GitHub Free Tier</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="text-sm text-gray-400 mb-1">Bandwidth</div>
              <div className="text-xl font-bold text-white">€0</div>
              <div className="text-xs text-gray-500 mt-1">GitHub Pages</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="text-sm text-gray-400 mb-1">Compute</div>
              <div className="text-xl font-bold text-white">€0</div>
              <div className="text-xs text-gray-500 mt-1">GitHub Actions</div>
            </div>
          </div>
        </div>
      </div>

      {isApproachingLimit && (
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h4 className="text-yellow-200 font-bold mb-1">Approaching Free Tier Limit</h4>
              <p className="text-sm text-yellow-100">
                You've used {ciUsage.percentage}% of your GitHub Actions minutes. 
                Consider optimizing workflows or upgrading if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-green-900 border border-green-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">✅</div>
          <div>
            <h4 className="text-green-200 font-bold mb-1">100% Cost Savings</h4>
            <p className="text-sm text-green-100">
              Running entirely on GitHub free tier. Total monthly savings: €{azureSavings + awsSavings} 
              compared to traditional cloud hosting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
