import React, { useState, useEffect } from 'react';
import { getCostHistory, getCIMinutesUsage } from '../services/mockData';

export function CostTracker() {
  const [costHistory] = useState(getCostHistory());
  const [ciUsage, setCiUsage] = useState(getCIMinutesUsage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCIUsage();
  }, []);

  const loadCIUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const usage = getCIMinutesUsage();
      setCiUsage(usage);
    } catch (error) {
      console.error('Failed to load CI usage:', error);
      setError('Failed to fetch CI data');
    } finally {
      setLoading(false);
    }
  };

  const currentSpend = 0;
  const azureSavings = 120;
  const awsSavings = 200;
  const totalSavings = azureSavings + awsSavings;

  const isApproachingLimit = ciUsage.percentage > 80;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-xl p-6 animate-pulse">
          <div className="h-32 bg-white/5 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Card - Big €0 Display */}
      <div className="glass rounded-2xl p-8 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 relative overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 animate-pulse" />
        
        <div className="relative z-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-4">
              <span className="text-2xl">🎉</span>
              <span>CURRENT MONTHLY SPEND</span>
              <span className="text-2xl">🎉</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="text-[120px] font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-green-400 to-cyan-400 leading-none animate-pulse-slow">
                €{currentSpend}
              </div>
            </div>
            <div className="text-lg text-gray-300 font-medium mt-4">
              100% Free Tier • Zero Cloud Costs
            </div>
          </div>

          {/* Savings Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="glass rounded-xl p-5 border border-white/10 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-400">vs. Azure ACI</span>
                <span className="text-3xl">☁️</span>
              </div>
              <div className="text-4xl font-black text-emerald-400 mb-1">€{azureSavings}</div>
              <div className="text-xs text-gray-400">saved per month</div>
            </div>

            <div className="glass rounded-xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-400">vs. AWS Lambda</span>
                <span className="text-3xl">🚀</span>
              </div>
              <div className="text-4xl font-black text-cyan-400 mb-1">€{awsSavings}</div>
              <div className="text-xs text-gray-400">saved per month</div>
            </div>
          </div>

          {/* Total Savings Badge */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full text-white font-bold text-lg shadow-lg shadow-emerald-500/25">
              <span>💰</span>
              <span>€{totalSavings}/mo Total Savings</span>
              <span>✨</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Chart */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-6">Budget vs Actual (Last 30 Days)</h3>
        <div className="h-56 flex items-end gap-1 px-2">
          {costHistory.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="relative w-full flex flex-col justify-end h-full">
                {/* Budget line (barely visible) */}
                <div
                  className="w-full bg-gray-600/30 rounded-t transition-all group-hover:bg-gray-500"
                  style={{ height: '6px' }}
                  title={`Budget: €${day.budget.toFixed(2)}`}
                />
                {/* Actual (green line at bottom - always €0) */}
                <div
                  className="w-full bg-emerald-500 rounded-t"
                  style={{ height: '6px' }}
                  title={`Actual: €${day.actual}`}
                />
              </div>
              {index % 5 === 0 && (
                <div className="text-[10px] text-gray-500 font-mono">
                  {new Date(day.date).getDate()}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 mt-8">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-600/50 rounded" />
            <span className="text-sm text-gray-400">Budget (€500/mo)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded" />
            <span className="text-sm font-semibold text-emerald-400">Actual (€0)</span>
          </div>
        </div>
      </div>

      {/* Resource Breakdown */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-6">Resource Usage</h3>
        
        {/* GitHub Actions Usage Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300">GitHub Actions Minutes</span>
            <span className="text-sm font-mono font-bold text-white">
              {ciUsage.used} / {ciUsage.total} min
            </span>
          </div>
          <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all duration-500 relative ${
                isApproachingLimit 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600'
              }`}
              style={{ width: `${ciUsage.percentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div className={`text-xs font-mono mt-2 ${isApproachingLimit ? 'text-amber-400' : 'text-gray-400'}`}>
            {ciUsage.percentage}% used • {ciUsage.total - ciUsage.used} minutes remaining
          </div>
        </div>

        {/* Resource Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">💾</span>
              <span className="text-sm font-semibold text-gray-400">Storage</span>
            </div>
            <div className="text-3xl font-black text-white mb-1">€0</div>
            <div className="text-xs text-emerald-400">GitHub Free Tier</div>
          </div>

          <div className="glass rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📡</span>
              <span className="text-sm font-semibold text-gray-400">Bandwidth</span>
            </div>
            <div className="text-3xl font-black text-white mb-1">€0</div>
            <div className="text-xs text-emerald-400">GitHub Pages</div>
          </div>

          <div className="glass rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚡</span>
              <span className="text-sm font-semibold text-gray-400">Compute</span>
            </div>
            <div className="text-3xl font-black text-white mb-1">€0</div>
            <div className="text-xs text-emerald-400">GitHub Actions</div>
          </div>
        </div>
      </div>

      {/* Warning Banner if approaching limit */}
      {isApproachingLimit && (
        <div className="glass rounded-xl p-5 border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚠️</div>
            <div className="flex-1">
              <h4 className="text-amber-400 font-bold text-lg mb-1">Approaching Free Tier Limit</h4>
              <p className="text-sm text-amber-100/80 mb-3">
                You've used {ciUsage.percentage}% of your GitHub Actions minutes this month.
              </p>
              <div className="text-xs text-gray-400">
                💡 Consider optimizing workflows or upgrading if needed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      <div className="glass rounded-xl p-5 border border-emerald-500/30 bg-emerald-500/10">
        <div className="flex items-start gap-4">
          <div className="text-3xl">✨</div>
          <div className="flex-1">
            <h4 className="text-emerald-400 font-bold text-lg mb-1">100% Cost Optimization</h4>
            <p className="text-sm text-emerald-100/80 mb-3">
              Running entirely on GitHub's free tier. Total monthly savings of €{totalSavings} compared to traditional cloud hosting.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-medium">Free Hosting</span>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-medium">Free CI/CD</span>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-medium">Free Storage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
