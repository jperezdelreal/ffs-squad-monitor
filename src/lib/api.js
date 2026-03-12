/**
 * API client for FFS Squad Monitor.
 * Centralizes all fetch calls with error handling and connection tracking.
 */

const listeners = new Set();
const endpointStatus = new Map();

let _connectionState = 'unknown'; // 'operational' | 'degraded' | 'offline' | 'unknown'

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

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    
    endpointStatus.set(url, true);
    updateConnectionState();
    return await res.json();
  } catch (error) {
    endpointStatus.set(url, false);
    updateConnectionState();
    logError(url, error);
    throw error;
  }
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
