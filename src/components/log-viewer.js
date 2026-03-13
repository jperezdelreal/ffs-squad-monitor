/**
 * Log viewer component.
 * Real-time log streaming via SSE with agent/level/date filtering.
 */
import { escapeHtml } from '../lib/util.js';

const logState = {
  entries: [],
  agentFilter: '',
  levelFilter: '',
  dateFilter: '',
  autoScroll: true,
  eventSource: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  maxReconnectAttempts: 10,
};

/** Called by scheduler — SSE handles real-time updates so this is a no-op. */
export async function refreshLogs() {}

export function initLogViewer() {
  setupFilters();
  setupAutoScroll();
  connectLogStream();
}

// ── Rendering ────────────────────────────────────────────

function formatLogEntry(e) {
  const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '??:??';
  const level = e._level || 'info';
  const agent = e._agent || 'unknown';
  const duration = e.duration != null ? `${e.duration}s` : '';
  const round = e.round != null ? `R${e.round}` : '';
  const metrics = e.metrics
    ? `issues=${e.metrics.issuesClosed || 0} prs=${e.metrics.prsMerged || 0}`
    : '';
  const parts = [round, e.phase || '', e.status || '', duration, metrics].filter(Boolean).join(' · ');

  return `<div class="log-entry">
    <span class="log-time">${escapeHtml(time)}</span>
    <span class="log-level ${level}">${level}</span>
    <span class="log-agent">${escapeHtml(agent)}</span>
    <span class="log-message">${escapeHtml(parts)}</span>
  </div>`;
}

function matchesFilters(entry) {
  if (logState.agentFilter && entry._agent !== logState.agentFilter) return false;
  if (logState.levelFilter && entry._level !== logState.levelFilter) return false;
  if (logState.dateFilter && entry.timestamp) {
    const entryDate = entry.timestamp.slice(0, 10);
    if (entryDate !== logState.dateFilter) return false;
  }
  return true;
}

function renderLogs() {
  const el = document.getElementById('log-entries');
  const filtered = logState.entries.filter(matchesFilters);
  const countEl = document.getElementById('log-count');
  if (countEl) {
    countEl.textContent = `(${filtered.length}${filtered.length !== logState.entries.length ? ' / ' + logState.entries.length : ''})`;
  }

  if (filtered.length === 0) {
    el.innerHTML = '<p class="log-empty">No matching log entries.</p>';
    return;
  }

  el.innerHTML = filtered.map(formatLogEntry).join('');

  if (logState.autoScroll) {
    el.scrollTop = el.scrollHeight;
  }
}

function addLogEntry(entry) {
  logState.entries.push(entry);
  // Discover new agents for filter dropdown
  const agentSelect = document.getElementById('log-agent');
  if (agentSelect) {
    const known = new Set([...agentSelect.options].map(o => o.value));
    if (entry._agent && !known.has(entry._agent)) {
      const opt = document.createElement('option');
      opt.value = entry._agent;
      opt.textContent = entry._agent;
      agentSelect.appendChild(opt);
    }
  }
  renderLogs();
}

// ── SSE Stream with Exponential Backoff ──────────────────

function getReconnectDelay() {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
  const delay = Math.min(1000 * Math.pow(2, logState.reconnectAttempts), 30000);
  return delay;
}

function setStreamBadge(status) {
  const badge = document.getElementById('stream-badge');
  const text = document.getElementById('stream-text');
  if (!badge || !text) return;
  
  switch (status) {
    case 'connected':
      badge.className = 'log-stream-badge';
      text.textContent = 'Streaming';
      break;
    case 'reconnecting':
      badge.className = 'log-stream-badge reconnecting';
      text.textContent = `Reconnecting${logState.reconnectAttempts > 0 ? ` (${logState.reconnectAttempts})` : ''}...`;
      break;
    case 'error':
      badge.className = 'log-stream-badge disconnected';
      text.textContent = 'Disconnected';
      break;
    case 'failed':
      badge.className = 'log-stream-badge failed';
      text.innerHTML = 'Connection failed <button class="retry-btn" onclick="window.__retryLogStream()">Retry</button>';
      break;
  }
}

function connectLogStream() {
  if (logState.eventSource) {
    logState.eventSource.close();
  }

  // Clear any pending reconnect timer
  if (logState.reconnectTimer) {
    clearTimeout(logState.reconnectTimer);
    logState.reconnectTimer = null;
  }

  const es = new EventSource('/api/logs/stream');
  logState.eventSource = es;

  es.onopen = () => {
    setStreamBadge('connected');
    logState.reconnectAttempts = 0;
    console.log('[LogViewer] SSE connected');
  };

  es.onmessage = (event) => {
    try {
      const entry = JSON.parse(event.data);
      addLogEntry(entry);
    } catch (err) {
      console.warn('[LogViewer] Failed to parse log entry:', err);
    }
  };

  es.onerror = () => {
    console.error('[LogViewer] SSE connection error');
    es.close();
    
    if (logState.reconnectAttempts >= logState.maxReconnectAttempts) {
      setStreamBadge('failed');
      console.error('[LogViewer] Max reconnection attempts reached. Giving up.');
      return;
    }
    
    const delay = getReconnectDelay();
    logState.reconnectAttempts++;
    setStreamBadge('reconnecting');
    
    console.log(`[LogViewer] Reconnecting in ${delay}ms (attempt ${logState.reconnectAttempts})...`);
    logState.reconnectTimer = setTimeout(() => {
      connectLogStream();
    }, delay);
  };
}

// Expose retry function globally
window.__retryLogStream = () => {
  logState.reconnectAttempts = 0;
  connectLogStream();
};

// ── Filters & Auto-scroll ────────────────────────────────

function setupAutoScroll() {
  const el = document.getElementById('log-entries');
  if (!el) return;
  el.addEventListener('scroll', () => {
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    logState.autoScroll = atBottom;
  });
}

function setupFilters() {
  const agentSelect = document.getElementById('log-agent');
  const levelSelect = document.getElementById('log-level');
  const dateInput = document.getElementById('log-date');
  if (!agentSelect || !levelSelect || !dateInput) return;

  dateInput.value = new Date().toISOString().slice(0, 10);

  // Pre-populate agent list from server
  fetch('/api/logs/files')
    .then(r => r.json())
    .then(data => {
      for (const agent of data.agents || []) {
        const opt = document.createElement('option');
        opt.value = agent;
        opt.textContent = agent;
        agentSelect.appendChild(opt);
      }
    })
    .catch(() => {});

  agentSelect.addEventListener('change', () => {
    logState.agentFilter = agentSelect.value;
    renderLogs();
  });

  levelSelect.addEventListener('change', () => {
    logState.levelFilter = levelSelect.value;
    renderLogs();
  });

  dateInput.addEventListener('change', () => {
    logState.dateFilter = dateInput.value;
    renderLogs();
  });
}
