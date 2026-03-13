import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/store';

const BLOCK_THRESHOLDS = [
  { maxHours: 4, label: 'Recently blocked', color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', dot: 'bg-yellow-400' },
  { maxHours: 24, label: 'Blocked >4h', color: 'bg-orange-500/20 border-orange-500/40 text-orange-300', dot: 'bg-orange-400' },
  { maxHours: Infinity, label: 'Blocked >24h', color: 'bg-red-500/20 border-red-500/40 text-red-300', dot: 'bg-red-500' },
]

function getBlockSeverity(hoursBlocked) {
  return BLOCK_THRESHOLDS.find(t => hoursBlocked < t.maxHours) || BLOCK_THRESHOLDS[BLOCK_THRESHOLDS.length - 1]
}

function formatBlockedDuration(ms) {
  const minutes = Math.floor(ms / (1000 * 60))
  if (minutes < 60) return minutes + 'm'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ' + (minutes % 60) + 'm'
  const days = Math.floor(hours / 24)
  return days + 'd ' + (hours % 24) + 'h'
}

function getBlockedInfo(agentIssues) {
  const now = Date.now()
  const blockedIssues = agentIssues
    .filter(issue => issue.state === 'open' && issue.labels?.some(l => typeof l === 'string' && l.startsWith('blocked-by:')))
    .map(issue => {
      const blockerLabel = issue.labels.find(l => typeof l === 'string' && l.startsWith('blocked-by:'))
      const blockerType = blockerLabel ? blockerLabel.replace('blocked-by:', '') : 'unknown'
      const since = issue.updatedAt ? new Date(issue.updatedAt).getTime() : new Date(issue.createdAt).getTime()
      const duration = now - since
      return { number: issue.number, title: issue.title, blockerType, duration, url: issue.url }
    })
    .sort((a, b) => b.duration - a.duration)

  if (blockedIssues.length === 0) return null

  const longestBlock = blockedIssues[0].duration
  const hoursBlocked = longestBlock / (1000 * 60 * 60)
  const severity = getBlockSeverity(hoursBlocked)

  return { blockedIssues, longestBlock, severity }
}

export function TeamBoard() {
  const {
    agents, agentsLoading, agentsError,
    issues, issuesLoading, issuesError,
    fetchIssues, fetchAgents,
  } = useStore();

  const loading = issuesLoading || agentsLoading;
  const error = issuesError || agentsError;

  useEffect(() => {
    const load = async () => {
      await fetchIssues();
      await fetchAgents();
    };
    load();
  }, []);

  const loadTeamData = async () => {
    await fetchIssues();
    await fetchAgents();
  };

  const agentBlockedInfo = useMemo(() => {
    const result = {}
    agents.forEach(agent => {
      const agentLabel = 'squad:' + agent.id
      const agentIssues = issues.filter(i =>
        i.state === 'open' && i.labels?.some(l => l === agentLabel)
      )
      const info = getBlockedInfo(agentIssues)
      if (info) result[agent.id] = info
    })
    return result
  }, [agents, issues])

  const workload = useMemo(() =>
    agents.map(agent => ({
      agent: agent.id,
      count: agent.taskCount || 0,
      label: agent.name,
    })),
    [agents]
  );

  const maxWorkload = Math.max(...workload.map(w => w.count), 1);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-xl p-6 animate-pulse">
          <div className="h-8 bg-white/5 rounded w-1/4 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-40 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Team Board</h2>
            <p className="text-sm text-gray-400">{agents.filter(a => a.status === 'active').length} of {agents.length} agents active</p>
          </div>
          <button
            onClick={loadTeamData}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="glass rounded-xl border border-yellow-500/20 p-4">
          <div className="flex items-start gap-3">
            <div className="text-xl">⚠️</div>
            <div className="flex-1">
              <p className="text-sm text-yellow-200">{error}</p>
              <p className="text-xs text-gray-400 mt-1">Showing cached data</p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...agents].sort((a, b) => {
          const aBlocked = agentBlockedInfo[a.id] ? 1 : 0
          const bBlocked = agentBlockedInfo[b.id] ? 1 : 0
          return bBlocked - aBlocked
        }).map((agent, index) => {
          const blocked = agentBlockedInfo[agent.id]
          return (
          <div
            key={agent.id}
            className={`glass rounded-xl p-5 border transition-all duration-200 hover:scale-105 animate-slide-up ${
              blocked
                ? 'border-red-500/30 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/20'
                : agent.status === 'active' 
                  ? 'border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/20' 
                  : 'border-white/10 hover:border-white/20'
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="text-5xl">{agent.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{agent.name}</h3>
                <p className="text-sm text-gray-400 truncate">{agent.role}</p>
              </div>
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${blocked ? 'bg-red-500' : agent.status === 'active' ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                {agent.status === 'active' && !blocked && (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
                {blocked && (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
                )}
              </div>
            </div>

            {blocked && (
              <div className={`mb-3 p-3 rounded-lg border ${blocked.severity.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${blocked.severity.dot} animate-pulse`} />
                  <span className="text-xs font-semibold uppercase">{blocked.severity.label}</span>
                  <span className="text-xs ml-auto font-mono">{formatBlockedDuration(blocked.longestBlock)}</span>
                </div>
                {blocked.blockedIssues.slice(0, 2).map(bi => (
                  <div key={bi.number} className="text-xs mt-1 truncate opacity-80">
                    <a href={bi.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      #{bi.number}
                    </a> blocked by <span className="font-mono">{bi.blockerType}</span>
                  </div>
                ))}
                {blocked.blockedIssues.length > 2 && (
                  <div className="text-xs mt-1 opacity-60">+{blocked.blockedIssues.length - 2} more</div>
                )}
              </div>
            )}

            {agent.currentTask ? (
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs font-semibold text-cyan-400 mb-2">CURRENT TASK</div>
                {typeof agent.currentTask === 'string' ? (
                  <p className="text-sm text-white line-clamp-2">{agent.currentTask}</p>
                ) : (
                  <a
                    href={agent.currentTask.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-cyan-400 transition-colors block line-clamp-2"
                  >
                    <span className="font-mono text-cyan-400">#{agent.currentTask.number}</span> {agent.currentTask.title}
                  </a>
                )}
                {agent.taskCount > 1 && (
                  <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <span className="font-mono">+{agent.taskCount - 1}</span>
                    <span>more in queue</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-gray-500 italic text-center">Idle • No active tasks</p>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Workload Chart */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-6">Workload Distribution</h3>
        <div className="space-y-4">
          {workload.map((item, index) => (
            <div 
              key={item.agent} 
              className="flex items-center gap-4 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-28 text-sm font-medium text-gray-300 truncate">{item.label}</div>
              <div className="flex-1 relative">
                <div className="h-10 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 ease-out relative"
                    style={{ width: `${(item.count / maxWorkload) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-mono font-bold text-white drop-shadow-lg">
                    {item.count} issue{item.count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
