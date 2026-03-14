import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/store';
import { ExportButton } from './ExportButton';
import { SkeletonContainer, SkeletonGrid, Skeleton } from './Skeleton';
import { buttonPress, cardHover } from '../lib/motion';
import { EmptyState, EmptyStateIllustrations } from './EmptyState';
import { ErrorState } from './ErrorState';

const BOTTLENECK_THRESHOLD = 5;

const STAGES = [
  { id: 'proposal', name: 'Proposal', emoji: '💡', color: 'from-yellow-500 to-amber-600' },
  { id: 'gdd', name: 'GDD', emoji: '📋', color: 'from-blue-500 to-cyan-600' },
  { id: 'issues', name: 'Issues', emoji: '🎯', color: 'from-purple-500 to-pink-600' },
  { id: 'code', name: 'Code', emoji: '💻', color: 'from-green-500 to-emerald-600' },
  { id: 'build', name: 'Build', emoji: '🔨', color: 'from-orange-500 to-red-600' },
  { id: 'deploy', name: 'Deploy', emoji: '🚀', color: 'from-cyan-500 to-blue-600' },
];

function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 24) return hours + 'h'
  const days = Math.floor(hours / 24)
  return days + 'd'
}

function calcAvgTimeInStage(issues) {
  const now = Date.now()
  const openWithTimestamp = issues.filter(i => i.state === 'open' && i.createdAt)
  if (openWithTimestamp.length === 0) return null
  const total = openWithTimestamp.reduce((sum, i) => sum + (now - new Date(i.createdAt).getTime()), 0)
  return total / openWithTimestamp.length
}

export function PipelineVisualizer() {
  const { issues, issuesLoading: loading, issuesError: error, fetchIssues } = useStore();
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  const analyzeStage = (stageIssues, label) => {
    const matched = stageIssues.filter(issue =>
      issue.labels?.some(l => l === label)
    );

    if (matched.length === 0) {
      return { status: 'pending', count: 0, issues: [], isBottleneck: false, avgTime: null };
    }

    const open = matched.filter(i => i.state === 'open');
    const closed = matched.filter(i => i.state === 'closed');

    let status = 'pending';
    if (open.length > 0) {
      status = 'in-progress';
    } else if (closed.length > 0) {
      status = 'complete';
    }

    const hasBlockedLabel = matched.some(i =>
      i.labels?.some(l => l.includes('blocked'))
    );
    if (hasBlockedLabel) {
      status = 'blocked';
    }

    const isBottleneck = open.length >= BOTTLENECK_THRESHOLD
    const avgTime = calcAvgTimeInStage(matched)

    if (isBottleneck && status !== 'blocked') {
      status = 'bottleneck'
    }

    return {
      status,
      count: matched.length,
      issues: matched.slice(0, 5).map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        url: i.url,
      })),
      isBottleneck,
      avgTime,
    };
  };

  const pipelineData = useMemo(() => {
    const repoGroups = {};
    issues.forEach(issue => {
      const repoName = issue.repoGithub?.split('/')[1] || issue.repo;
      if (!repoGroups[repoName]) repoGroups[repoName] = [];
      repoGroups[repoName].push(issue);
    });

    const data = {};
    Object.entries(repoGroups).forEach(([repoName, repoIssues]) => {
      data[repoName] = {
        proposal: analyzeStage(repoIssues, 'pipeline:proposal'),
        gdd: analyzeStage(repoIssues, 'pipeline:gdd'),
        issues: analyzeStage(repoIssues, 'pipeline:issues'),
        code: analyzeStage(repoIssues, 'pipeline:code'),
        build: analyzeStage(repoIssues, 'pipeline:build'),
        deploy: analyzeStage(repoIssues, 'pipeline:deploy'),
      };
    });

    return data;
  }, [issues]);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'from-gray-600 to-gray-700',
      'in-progress': 'from-amber-500 to-yellow-600',
      complete: 'from-emerald-500 to-green-600',
      blocked: 'from-red-500 to-rose-600',
      bottleneck: 'from-orange-600 to-red-700',
    };
    return colors[status] || colors.pending;
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏸️',
      'in-progress': '⚡',
      complete: '✅',
      blocked: '🚫',
      bottleneck: '🔥',
    };
    return icons[status] || icons.pending;
  };

  if (loading) {
    return (
      <SkeletonContainer>
        <div className="h-8 bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%] animate-shimmer rounded w-1/4 mb-6" />
        <SkeletonGrid cols={7} rows={6} itemComponent={() => <Skeleton className="h-24 rounded-lg" />} />
      </SkeletonContainer>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Connection Error"
        message="Unable to load pipeline data. The backend might be unreachable."
        error={error}
        retry={fetchIssues}
        retryLabel="Retry"
      />
    );
  }

  const repoCount = Object.keys(pipelineData).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="glass depth-surface rounded-xl p-4 sm:p-6 border border-white/10 snap-start">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-h2 md:text-h1 font-semibold text-white mb-1">Pipeline Status</h2>
            <p className="text-body-sm text-gray-400">{repoCount} repositories tracked</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton endpoint="/api/export/issues?state=all" label="Export" />
            <button
              onClick={fetchIssues}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-glow-cyan transition-all flex items-center gap-2 min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-br from-gray-600 to-gray-700 rounded" />
            <span className="text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-br from-amber-500 to-yellow-600 rounded" />
            <span className="text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded" />
            <span className="text-gray-400">Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-br from-red-500 to-rose-600 rounded" />
            <span className="text-gray-400">Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-br from-orange-600 to-red-700 rounded animate-pulse" />
            <span className="text-gray-400 hidden sm:inline">Bottleneck ({BOTTLENECK_THRESHOLD}+ issues)</span>
            <span className="text-gray-400 sm:hidden">Bottleneck</span>
          </div>
        </div>
      </div>

      {/* Pipeline Grid */}
      {repoCount === 0 ? (
        <div className="glass rounded-xl p-12 border border-white/10">
          <div className="text-center">
            <div className="text-6xl mb-4">🔄</div>
            <h3 className="text-body-lg font-semibold text-white mb-2">No Pipeline Data</h3>
            <p className="text-gray-400 text-sm">Pipeline stages will appear here once configured</p>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl border border-white/10 overflow-hidden snap-start">
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left p-3 sm:p-4 text-caption sm:text-body-sm font-semibold text-gray-300 uppercase tracking-wide sticky left-0 bg-[#151920]/95 backdrop-blur-sm z-10">
                    Repository
                  </th>
                  {STAGES.map(stage => (
                    <th key={stage.id} className="text-center p-2 sm:p-4 text-caption sm:text-body-sm font-semibold text-gray-300 uppercase tracking-wide min-w-[100px] sm:min-w-[140px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl sm:text-2xl">{stage.emoji}</span>
                        <span className="hidden sm:inline">{stage.name}</span>
                        <span className="sm:hidden text-[10px]">{stage.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(pipelineData).map(([repo, stages], rowIndex) => (
                  <tr 
                    key={repo} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors animate-slide-up"
                    style={{ animationDelay: `${rowIndex * 0.05}s` }}
                  >
                    <td className="p-4 text-body-sm font-semibold text-white sticky left-0 bg-[#151920]/95 backdrop-blur-sm border-r border-white/5">
                      {repo}
                    </td>
                    {STAGES.map(stage => {
                      const stageData = stages[stage.id];
                      const cellClasses = [
                        'bg-gradient-to-br',
                        getStatusColor(stageData.status),
                        'rounded-lg p-3 text-center cursor-pointer transition-all hover:scale-105 hover:shadow-lg relative group',
                        stageData.isBottleneck ? 'ring-2 ring-orange-400/60 animate-pulse' : '',
                      ].filter(Boolean).join(' ')
                      return (
                        <td key={stage.id} className="p-3">
                          <div
                            onClick={() => setSelectedCell({ repo, stage: stage.name, data: stageData })}
                            className={cellClasses}
                          >
                            <div className="text-2xl mb-1">{getStatusIcon(stageData.status)}</div>
                            {stageData.count > 0 && (
                              <div className="text-xs font-mono font-bold text-white">
                                {stageData.count} issue{stageData.count !== 1 ? 's' : ''}
                              </div>
                            )}
                            {stageData.count === 0 && (
                              <div className="text-xs font-mono text-white/60">-</div>
                            )}
                            {stageData.avgTime !== null && stageData.count > 0 && (
                              <div className="text-[10px] font-mono text-white/70 mt-1">
                                avg {formatDuration(stageData.avgTime)}
                              </div>
                            )}
                            {stageData.isBottleneck && (
                              <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                                STUCK
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedCell && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="glass rounded-xl border border-white/20 max-w-2xl w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-semibold text-white">
                {selectedCell.repo} • {selectedCell.stage}
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${getStatusColor(selectedCell.data.status)} text-white font-medium`}>
                <span>{getStatusIcon(selectedCell.data.status)}</span>
                <span className="capitalize">{selectedCell.data.status.replace('-', ' ')}</span>
              </div>
              {selectedCell.data.isBottleneck && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300 text-sm font-medium">
                  🔥 Bottleneck — {selectedCell.data.count} issues accumulated
                </div>
              )}
              {selectedCell.data.avgTime !== null && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm">
                  ⏱️ Avg time in stage: {formatDuration(selectedCell.data.avgTime)}
                </div>
              )}
            </div>

            {selectedCell.data.issues.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Related Issues:</h4>
                {selectedCell.data.issues.map(issue => (
                  <a
                    key={issue.number}
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 glass hover:border-cyan-500/30 rounded-lg border border-white/10 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-mono font-semibold text-cyan-400">#{issue.number}</span>
                      <span className="text-sm text-white flex-1">{issue.title}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${issue.state === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {issue.state}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No issues found for this stage</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
