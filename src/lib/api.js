/**
 * API client for FFS Squad Monitor.
 * Centralizes all fetch calls with error handling, connection tracking,
 * request deduplication, and response caching.
 */

import { createRequestCache } from './request-cache.js'

const listeners = new Set();
const endpointStatus = new Map();

let _connectionState = 'unknown'; // 'operational' | 'degraded' | 'offline' | 'unknown'

// Shared request cache — deduplicates concurrent calls and caches responses
export const requestCache = createRequestCache({ defaultTTL: 30_000 })

export function getConnectionState() {
  return _connectionState;
}

export function onConnectionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function updateConnectionState() {
  const statuses = [...endpointStatus.values()];
  if (statuses.length === 0) {
    setConnectionState('unknown');
    return;
  }
  
  const failedCount = statuses.filter(ok => !ok).length;
  const totalCount = statuses.length;
  
  let newState;
  if (failedCount === 0) {
    newState = 'operational';
  } else if (failedCount === totalCount) {
    newState = 'offline';
  } else {
    newState = 'degraded';
  }
  
  setConnectionState(newState);
}

function setConnectionState(state) {
  if (_connectionState !== state) {
    _connectionState = state;
    listeners.forEach(fn => fn(state));
  }
}

function logError(endpoint, error) {
  console.error(`[API Error] ${endpoint}:`, {
    message: error.message,
    status: error.status,
    timestamp: new Date().toISOString()
  });
}

function rawFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).then(res => {
    clearTimeout(timeoutId);
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    endpointStatus.set(url, true);
    updateConnectionState();
    return res.json();
  }).catch(error => {
    clearTimeout(timeoutId);
    endpointStatus.set(url, false);
    updateConnectionState();
    logError(url, error);
    throw error;
  });
}

async function safeFetch(url, options = {}) {
  return requestCache.dedupedFetch(
    url,
    () => rawFetch(url, options),
    { ttl: options.cacheTTL, noCache: options.noCache },
  );
}

export async function fetchHeartbeat() {
  try {
    return await safeFetch('/api/heartbeat');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchLogs() {
  try {
    return await safeFetch('/api/logs');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchTimeline() {
  try {
    return await safeFetch('/api/timeline');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchRepos() {
  try {
    return await safeFetch('/api/repos');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchAgents() {
  try {
    return await safeFetch('/api/agents');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchIssues() {
  try {
    return await safeFetch('/api/issues');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchPulse() {
  try {
    return await safeFetch('/api/pulse');
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchHealth() {
  try {
    return await safeFetch('/api/health', { cacheTTL: 10_000 });
  } catch (error) {
    return { error: true, message: error.message };
  }
}

export async function fetchMetrics(channel, { from, to, interval } = {}) {
  try {
    const params = new URLSearchParams({ channel })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (interval) params.set('interval', interval)
    return await safeFetch(`/api/metrics?${params}`, { cacheTTL: 60_000 });
  } catch (error) {
    return { error: true, message: error.message };
  }
}