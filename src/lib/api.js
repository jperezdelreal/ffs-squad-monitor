/**
 * API client for FFS Squad Monitor.
 * Centralizes all fetch calls with error handling and connection tracking.
 */

const listeners = new Set();

let _connected = false;

export function isConnected() {
  return _connected;
}

export function onConnectionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setConnected(ok) {
  if (_connected !== ok) {
    _connected = ok;
    listeners.forEach(fn => fn(ok));
  }
}

async function safeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  setConnected(true);
  return res.json();
}

export async function fetchHeartbeat() {
  try {
    return await safeFetch('/api/heartbeat');
  } catch {
    setConnected(false);
    return null;
  }
}

export async function fetchLogs() {
  try {
    return await safeFetch('/api/logs');
  } catch {
    return null;
  }
}

export async function fetchRepos() {
  try {
    return await safeFetch('/api/repos');
  } catch {
    return null;
  }
}
