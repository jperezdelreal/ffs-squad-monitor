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

// ── SSE Stream ───────────────────────────────────────────

function setStreamBadge(ok) {
  const badge = document.getElementById('stream-badge');
  const text = document.getElementById('stream-text');
  if (!badge || !text) return;
  badge.className = ok ? 'log-stream-badge' : 'log-stream-badge disconnected';
  text.textContent = ok ? 'Streaming' : 'Disconnected';
}

function connectLogStream() {
  if (logState.eventSource) {
    logState.eventSource.close();
  }

  const es = new EventSource('/api/logs/stream');
  logState.eventSource = es;

  es.onopen = () => setStreamBadge(true);

  es.onmessage = (event) => {
    try {
      const entry = JSON.parse(event.data);
      addLogEntry(entry);
    } catch { /* skip malformed */ }
  };

  es.onerror = () => {
    setStreamBadge(false);
    setTimeout(() => {
      if (es.readyState === EventSource.CLOSED) {
        connectLogStream();
      }
    }, 5000);
  };
}

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
