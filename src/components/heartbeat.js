/**
 * Heartbeat card component.
 * Renders Ralph-watch heartbeat data: status dot, metadata fields, round info.
 */
import { fetchHeartbeat } from '../lib/api.js';
import { timeAgo } from '../lib/util.js';

export async function refreshHeartbeat() {
  const hb = await fetchHeartbeat();
  if (!hb) return;
  renderHeartbeat(hb);
}

function renderHeartbeat(hb) {
  const dot = document.getElementById('ralph-dot');
  const statusText = document.getElementById('status-text');
  const dataEl = document.getElementById('heartbeat-data');
  const roundInfo = document.getElementById('round-info');

  const statusMap = { idle: 'green', running: 'yellow', error: 'red', offline: 'gray' };
  const statusClass = statusMap[hb.status] || 'gray';
  dot.className = `dot ${statusClass}`;
  statusText.textContent = hb.status
    ? hb.status.charAt(0).toUpperCase() + hb.status.slice(1)
    : 'Unknown';

  const repos = hb.repos ? hb.repos.join(', ') : 'N/A';
  const ago = timeAgo(hb.timestamp);

  dataEl.innerHTML = `
    <dt>Updated</dt><dd>${ago}</dd>
    <dt>Round</dt><dd>${hb.round ?? '—'}</dd>
    <dt>PID</dt><dd>${hb.pid ?? '—'}</dd>
    <dt>Interval</dt><dd>${hb.interval ? hb.interval + ' min' : '—'}</dd>
    <dt>Status</dt><dd>${hb.lastStatus || '—'}</dd>
    <dt>Duration</dt><dd>${hb.lastDuration ? hb.lastDuration + 's' : '—'}</dd>
    <dt>Failures</dt><dd>${hb.consecutiveFailures ?? 0}</dd>
    <dt>Repos</dt><dd>${repos}</dd>
  `;

  roundInfo.textContent =
    `Round ${hb.round ?? '?'} · Last run: ${hb.lastStatus || 'N/A'} (${hb.lastDuration ?? '?'}s)`;
}
