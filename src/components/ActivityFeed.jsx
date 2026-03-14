import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/store';
import { getConfigSync } from '../services/config';
import { ExportButton } from './ExportButton';
import { staggerContainer, staggerItem, springPresets } from '../lib/motion';
import { SkeletonContainer, SkeletonList, SkeletonText } from './Skeleton';
import { PulseDot } from './PulseIndicator';

function getRepoColor(repoName) {
  const config = getConfigSync();
  const repos = config?.repos || [];
  const repo = repos.find(r => repoName.includes(r.name));
  return repo?.color || '#6b7280';
}

export function ActivityFeed() {
  const { events, eventsLoading: loading, eventsError: error, fetchEvents, sseStatus } = useStore();
  const [filters, setFilters] = useState({
    repo: 'all',
    type: 'all',
  });
  const [newEventIds, setNewEventIds] = useState(new Set());

  useEffect(() => {
    if (sseStatus !== 'streaming') {
      fetchEvents();
    }
  }, []);

  // Track new events
  useEffect(() => {
    if (events.length > 0) {
      const latestEvent = events[0];
      const timeSinceEvent = Date.now() - new Date(latestEvent.createdAt).getTime();
      
      // Mark events from last 30 seconds as new
      if (timeSinceEvent < 30000) {
        setNewEventIds(prev => {
          const next = new Set(prev);
          next.add(latestEvent.id);
          return next;
        });
        
        // Remove after 5 seconds
        const timeout = setTimeout(() => {
          setNewEventIds(prev => {
            const next = new Set(prev);
            next.delete(latestEvent.id);
            return next;
          });
        }, 5000);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [events]);

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
      <SkeletonContainer>
        <SkeletonText lines={1} className="w-1/4 mb-4 h-8" />
        <SkeletonList count={5} />
      </SkeletonContainer>
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={springPresets.default}
      className="space-y-4"
    >
      {/* Filters Bar */}
      <div className="glass rounded-xl p-3 sm:p-4 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <label className="text-sm font-medium text-gray-400">Repository</label>
            <select
              value={filters.repo}
              onChange={(e) => setFilters({ ...filters, repo: e.target.value })}
              className="w-full sm:w-auto bg-white/5 text-white rounded-lg px-3 sm:px-4 py-2 text-sm border border-white/10 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all min-h-[44px]"
            >
              <option value="all">All Repos</option>
              {repos.map(repo => (
                <option key={repo} value={repo}>{repo.split('/')[1]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <label className="text-sm font-medium text-gray-400">Event Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full sm:w-auto bg-white/5 text-white rounded-lg px-3 sm:px-4 py-2 text-sm border border-white/10 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all min-h-[44px]"
            >
              <option value="all">All Types</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type.replace('Event', '')}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <ExportButton endpoint="/api/export/issues?state=all" label="Export" />
            <button
              onClick={fetchEvents}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2 min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Activity Stream</h3>
            <PulseDot status={sseStatus} size="xs" />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {filteredEvents.length} events
          </span>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-white mb-2">No Activity Yet</h3>
            <p className="text-gray-400 text-sm">Activity feed will appear here once events are detected</p>
          </div>
        ) : (
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="divide-y divide-white/5 max-h-[calc(100vh-20rem)] overflow-y-auto"
          >
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event) => {
                const isNew = newEventIds.has(event.id);
                return (
                <motion.div
                  key={event.id}
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                  exit={{ opacity: 0, x: -20 }}
                  layout
                  transition={springPresets.default}
                  className={`p-4 hover:bg-white/5 group relative ${isNew ? 'bg-cyan-500/5' : ''}`}
                >
                <motion.div variants={cardHover}>
                  {isNew && (
                    <motion.div
                      className="absolute inset-0 border-l-2 border-cyan-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: 2 }}
                    />
                  )}
                <div className="flex items-start gap-4">
                  {/* Timeline Dot */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <motion.div
                      whileHover={{ scale: 1.5 }}
                      className="w-3 h-3 rounded-full ring-4 ring-white/10"
                      style={{ backgroundColor: getRepoColor(event.repo) }}
                      animate={isNew ? {
                        scale: [1, 1.3, 1],
                        boxShadow: [
                          '0 0 0px rgba(6, 182, 212, 0)',
                          '0 0 15px rgba(6, 182, 212, 0.8)',
                          '0 0 0px rgba(6, 182, 212, 0)',
                        ],
                      } : {}}
                      transition={isNew ? { duration: 2, repeat: 2 } : springPresets.snappy}
                    />
                  </div>

                  {/* Event Icon */}
                  <motion.div 
                    className="text-3xl"
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={springPresets.bouncy}
                  >
                    {getEventIcon(event.type)}
                  </motion.div>

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
              </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
