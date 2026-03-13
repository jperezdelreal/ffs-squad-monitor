import React, { useState, useEffect } from 'react';
import { useStore } from '../store/store';
import { getConfigSync } from '../services/config';

function getRepoColor(repoName) {
  const config = getConfigSync();
  const repos = config?.repos || [];
  const repo = repos.find(r => repoName.includes(r.name));
  return repo?.color || '#6b7280';
}

export function ActivityFeed() {
  const { events, eventsLoading: loading, eventsError: error, fetchEvents } = useStore();
  const [filters, setFilters] = useState({
    repo: 'all',
    type: 'all',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const getEventIcon = (type) => {
    const icons = {
      PushEvent: '📝',
      PullRequestEvent: '🔀',
      IssuesEvent: '🎯',
      CreateEvent: '✨',
      DeleteEvent: '🗑️',
      WatchEvent: '⭐',
      ForkEvent: '🍴',
      ReleaseEvent: '🚀',
    };
    return icons[type] || '📋';
  };

  const getEventDescription = (event) => {
    switch (event.type) {
      case 'PushEvent':
        const commits = event.payload.commits?.length || 0;
        return `pushed ${commits} commit${commits !== 1 ? 's' : ''}`;
      case 'PullRequestEvent':
        return `${event.payload.action} pull request #${event.payload.number}`;
      case 'IssuesEvent':
        return `${event.payload.action} issue #${event.payload.issue?.number}`;
      case 'CreateEvent':
        return `created ${event.payload.ref_type}`;
      case 'DeleteEvent':
        return `deleted ${event.payload.ref_type}`;
      case 'WatchEvent':
        return 'starred the repository';
      case 'ForkEvent':
        return 'forked the repository';
      case 'ReleaseEvent':
        return `${event.payload.action} release ${event.payload.release?.tag_name}`;
      default:
        return event.type.replace('Event', '').toLowerCase();
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const filteredEvents = events.filter(event => {
    if (filters.repo !== 'all' && !event.repo.includes(filters.repo)) return false;
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    return true;
  });

  const repos = [...new Set(events.map(e => e.repo))];
  const eventTypes = [...new Set(events.map(e => e.type))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-xl p-6 animate-pulse">
          <div className="h-8 bg-white/5 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl border border-red-500/20 p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchEvents}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters Bar */}
      <div className="glass rounded-xl p-4 border border-white/10">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-400">Repository</label>
            <select
              value={filters.repo}
              onChange={(e) => setFilters({ ...filters, repo: e.target.value })}
              className="bg-white/5 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
            >
              <option value="all">All Repos</option>
              {repos.map(repo => (
                <option key={repo} value={repo}>{repo.split('/')[1]}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-400">Event Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="bg-white/5 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
            >
              <option value="all">All Types</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type.replace('Event', '')}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchEvents}
            className="ml-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-white mb-2">No Activity Yet</h3>
            <p className="text-gray-400 text-sm">Activity feed will appear here once events are detected</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[calc(100vh-20rem)] overflow-y-auto">
            {filteredEvents.map((event, index) => (
              <div 
                key={event.id} 
                className="p-4 hover:bg-white/5 transition-all duration-200 group animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-4">
                  {/* Timeline Dot */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div 
                      className="w-3 h-3 rounded-full ring-4 ring-white/10 transition-all group-hover:ring-8"
                      style={{ backgroundColor: getRepoColor(event.repo) }}
                    />
                  </div>

                  {/* Event Icon */}
                  <div className="text-3xl transition-transform group-hover:scale-110">
                    {getEventIcon(event.type)}
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        {event.repo.split('/')[1]}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-400 font-mono">{formatTime(event.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-cyan-400">{event.actor}</span>
                      {' '}
                      <span className="text-gray-400">{getEventDescription(event)}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
