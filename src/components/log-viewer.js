/**
 * Log viewer component.
 * Renders the activity log with filtering support.
 */
import { fetchLogs } from '../lib/api.js';

const MAX_VISIBLE = 50;
let currentFilter = 'all';

export async function refreshLogs() {
  const entries = await fetchLogs();
  if (!entries) return;
  renderLogs(entries);
}

export function initLogViewer() {
  const toolbar = document.getElementById('log-toolbar');
  if (!toolbar) return;

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    toolbar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Trigger a re-render with cached data
    refreshLogs();
  });
}

function renderLogs(entries) {
  const el = document.getElementById('log-entries');
  if (!entries || entries.length === 0) {
    el.innerHTML = '<p class="empty-state">No log entries yet today.</p>';
    return;
  }

  let filtered = entries;
  if (currentFilter === 'success') {
    filtered = entries.filter(e => e.exitCode === 0);
  } else if (currentFilter === 'error') {
    filtered = entries.filter(e => e.exitCode !== 0);
  }

  if (filtered.length === 0) {
    el.innerHTML = `<p class="empty-state">No ${currentFilter} entries.</p>`;
    return;
  }

  el.innerHTML = filtered.slice(-MAX_VISIBLE).reverse().map(e => {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '?';
    const icon = e.exitCode === 0 ? '✅' : '❌';
    const cls = e.exitCode === 0 ? '' : ' log-error';
    const metrics = e.metrics
      ? ` <span class="log-metrics">issues=${e.metrics.issuesClosed || 0} prs=${e.metrics.prsMerged || 0}</span>`
      : '';
    return `<div class="log-entry${cls}">${icon} <span class="log-time">${time}</span> Round ${e.round || '?'} <span class="log-duration">(${e.duration || '?'}s)</span>${metrics}</div>`;
  }).join('');
}
