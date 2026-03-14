import React, { useEffect } from 'react';
import { useStore } from '../store/store';
import { ExportButton } from './ExportButton';
import { SkeletonContainer, SkeletonGrid, SkeletonStatCard, Skeleton } from './Skeleton';
import { AnimatedCounter } from './AnimatedCounter';
import { cardHover, buttonPress } from '../lib/motion';
import { ErrorState } from './ErrorState';

export function CostTracker() {
  const { usage, usageLoading: loading, usageError: error, fetchUsage } = useStore();

  useEffect(() => {
    fetchUsage();
  }, []);

  if (loading) {
    return (
      <SkeletonContainer>
        <Skeleton className="h-32 rounded-2xl mb-6" />
        <SkeletonGrid cols={2} rows={2} itemComponent={SkeletonStatCard} />
      </SkeletonContainer>
    );
  }

  if (error || !usage) {
    return (
      <ErrorState
        title="Cost data not available"
        message="Unable to fetch GitHub Actions usage data. This may be due to missing permissions or the backend being unreachable."
        error={error}
        retry={fetchUsage}
        retryLabel="Retry"
      />
    );
  }

  const usedMinutes = usage.totalMinutesUsed || 0;
  const totalMinutes = usage.includedMinutes || 2000;
  const percentage = usage.percentage || 0;
  const isApproachingLimit = percentage > 80;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Export header */}
      <div className="flex justify-end">
        <ExportButton endpoint="/api/export/usage" label="Export Usage" />
      </div>

      {/* GitHub Actions Usage */}
      <div className="glass-lg depth-floating rounded-2xl p-8 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 animate-pulse" />
        <div className="relative z-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-4">
              <span className="text-2xl">⚡</span>
              <span>GITHUB ACTIONS USAGE</span>
              <span className="text-2xl">⚡</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className={`text-[80px] font-black leading-none ${
                isApproachingLimit
                  ? 'text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-yellow-500'
                  : 'text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-green-400 to-cyan-400'
              }`}>
                {usedMinutes}
              </div>
              <div className="text-left">
                <div className="text-2xl text-gray-400 font-medium">/ {totalMinutes}</div>
                <div className="text-sm text-gray-500">minutes this month</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-500 relative ${
                  isApproachingLimit
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                }`}
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <div className={`text-xs font-mono mt-2 text-center ${isApproachingLimit ? 'text-amber-400' : 'text-gray-400'}`}>
              {percentage}% used • {totalMinutes - usedMinutes} minutes remaining
            </div>
          </div>

          <div className="text-center text-xs text-gray-500">
            Source: {usage.source === 'billing' ? 'GitHub Billing API' : 'Workflow run aggregation'}
            {usage.totalRuns != null && ` • ${usage.totalRuns} recent runs`}
          </div>
        </div>
      </div>

      {/* Per-repo breakdown (only from workflow_runs source) */}
      {usage.repos && usage.repos.length > 0 && (
        <div className="glass depth-surface rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-6">Usage by Repository</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {usage.repos.map((repo) => (
              <div key={repo.repo} className="glass depth-raised rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 hover:shadow-glow-cyan-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{repo.emoji}</span>
                  <span className="text-sm font-semibold text-gray-300">{repo.label}</span>
                </div>
                <div className="text-2xl font-black text-white mb-1">{repo.durationMinutes} min</div>
                <div className="text-xs text-gray-400">{repo.runs} workflow runs</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Cards */}
      <div className="glass depth-surface rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-6">Resource Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass depth-raised rounded-lg p-4 border border-white/10 hover:shadow-depth-floating transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">💾</span>
              <span className="text-sm font-semibold text-gray-400">Storage</span>
            </div>
            <div className="text-3xl font-black text-white mb-1">€0</div>
            <div className="text-xs text-emerald-400">GitHub Free Tier</div>
          </div>

          <div className="glass depth-raised rounded-lg p-4 border border-white/10 hover:shadow-depth-floating transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📡</span>
              <span className="text-sm font-semibold text-gray-400">Bandwidth</span>
            </div>
            <div className="text-3xl font-black text-white mb-1">€0</div>
            <div className="text-xs text-emerald-400">GitHub Pages</div>
          </div>

          <div className="glass depth-raised rounded-lg p-4 border border-white/10 hover:shadow-depth-floating transition-all">
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
                You've used {percentage}% of your GitHub Actions minutes this month.
              </p>
              <div className="text-xs text-gray-400">
                💡 Consider optimizing workflows or upgrading if needed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {!isApproachingLimit && (
        <div className="glass rounded-xl p-5 border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-start gap-4">
            <div className="text-3xl">✨</div>
            <div className="flex-1">
              <h4 className="text-emerald-400 font-bold text-lg mb-1">Running on GitHub Free Tier</h4>
              <p className="text-sm text-emerald-100/80 mb-3">
                All CI/CD powered by GitHub Actions. Using {usedMinutes} of {totalMinutes} included minutes.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-medium">Free Hosting</span>
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-medium">Free CI/CD</span>
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-medium">Free Storage</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
