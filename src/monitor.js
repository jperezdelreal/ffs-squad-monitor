/**
 * FFS Squad Monitor — Sprint 0
 *
 * Reads heartbeat data and updates the dashboard.
 * In dev mode, uses a mock heartbeat. In production,
 * a backend endpoint will serve live data from ralph-watch.ps1.
 */

const HEARTBEAT_POLL_INTERVAL = 5000; // ms
const HEARTBEAT_API = '/api/heartbeat';

// Mock heartbeat for Sprint 0 (no backend yet)
function getMockHeartbeat() {
  return {
    timestamp: new Date().toISOString(),
    status: 'idle',
    round: 1,
    pid: 0,
    interval: 15,
    lastStatus: 'OK',
    lastDuration: 0.2,
  };
}

function updateHeartbeatUI(heartbeat) {
  const dot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');
  const dataEl = document.getElementById('heartbeat-data');
  const roundInfo = document.getElementById('round-info');

  // Update status indicator
  dot.className = `status-dot ${heartbeat.status || 'unknown'}`;
  statusText.textContent = heartbeat.status
    ? heartbeat.status.charAt(0).toUpperCase() + heartbeat.status.slice(1)
    : 'Unknown';

  // Update heartbeat details
  dataEl.innerHTML = `
    <dt>Timestamp</dt><dd>${heartbeat.timestamp || '—'}</dd>
    <dt>Round</dt><dd>${heartbeat.round ?? '—'}</dd>
    <dt>PID</dt><dd>${heartbeat.pid ?? '—'}</dd>
    <dt>Interval</dt><dd>${heartbeat.interval ? heartbeat.interval + ' min' : '—'}</dd>
    <dt>Last Status</dt><dd>${heartbeat.lastStatus || '—'}</dd>
    <dt>Duration</dt><dd>${heartbeat.lastDuration ? heartbeat.lastDuration + 's' : '—'}</dd>
  `;

  // Update round info
  roundInfo.textContent = `Round ${heartbeat.round ?? '?'} · Last run: ${heartbeat.lastStatus || 'N/A'} (${heartbeat.lastDuration ?? '?'}s)`;
}

async function fetchHeartbeat() {
  try {
    const response = await fetch(HEARTBEAT_API);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    // Backend not available yet — use mock data in Sprint 0
    return getMockHeartbeat();
  }
}

async function pollHeartbeat() {
  const heartbeat = await fetchHeartbeat();
  updateHeartbeatUI(heartbeat);
}

// Start polling
pollHeartbeat();
setInterval(pollHeartbeat, HEARTBEAT_POLL_INTERVAL);

console.log('[FFS Monitor] Dashboard initialized — polling every', HEARTBEAT_POLL_INTERVAL / 1000, 'seconds');
