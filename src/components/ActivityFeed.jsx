import React, { useState, useEffect } from 'react';
import { fetchAllRepoEvents, getRepoColor } from '../services/github';

export function ActivityFeed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    repo: 'all',
    type: 'all',
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchAllRepoEvents();
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">
          Loading activity feed...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Repository:</label>
            <select
              value={filters.repo}
              onChange={(e) => setFilters({ ...filters, repo: e.target.value })}
              className="bg-gray-700 text-white rounded px-3 py-1 text-sm border border-gray-600"
            >
              <option value="all">All Repos</option>
              {repos.map(repo => (
                <option key={repo} value={repo}>{repo.split('/')[1]}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Event Type:</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="bg-gray-700 text-white rounded px-3 py-1 text-sm border border-gray-600"
            >
              <option value="all">All Types</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type.replace('Event', '')}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadEvents}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 divide-y divide-gray-700 max-h-[calc(100vh-16rem)] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No events found
          </div>
        ) : (
          filteredEvents.map(event => (
            <div key={event.id} className="p-4 hover:bg-gray-750 transition-colors">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getEventIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: getRepoColor(event.repo) }}
                    />
                    <span className="text-sm font-medium text-white">
                      {event.repo.split('/')[1]}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">{formatTime(event.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    <span className="font-medium">{event.actor}</span>
                    {' '}
                    {getEventDescription(event)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
