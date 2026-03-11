/**
 * FFS Squad Monitor — Multi-repo dashboard
 *
 * Polls:
 *   /api/heartbeat — ralph-watch status (every 5s)
 *   /api/logs      — ralph-watch activity log (every 10s)
 *   /api/repos     — all studio repos status (every 30s)
 */

const HEARTBEAT_POLL = 5000;
const LOG_POLL = 10000;
const REPOS_POLL = 30000;

let connected = false;

function setConnected(ok) {
  connected = ok;
  const dot = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');
  dot.className = ok ? 'dot green' : 'dot red';
  text.textContent = ok ? 'Connected' : 'Disconnected';
}

// ── Heartbeat ────────────────────────────────────────────
function updateHeartbeatUI(hb) {
  const dot = document.getElementById('ralph-dot');
  const statusText = document.getElementById('status-text');
  const dataEl = document.getElementById('heartbeat-data');
  const roundInfo = document.getElementById('round-info');

  const statusMap = { idle: 'green', running: 'yellow', error: 'red', offline: 'gray' };
  dot.className = `dot ${statusMap[hb.status] || 'gray'}`;
  statusText.textContent = hb.status
    ? hb.status.charAt(0).toUpperCase() + hb.status.slice(1)
    : 'Unknown';

  const repos = hb.repos ? hb.repos.join(', ') : 'N/A';
  dataEl.innerHTML = `
    <dt>Timestamp</dt><dd>${hb.timestamp || '\u2014'}</dd>
    <dt>Round</dt><dd>${hb.round ?? '\u2014'}</dd>
    <dt>PID</dt><dd>${hb.pid ?? '\u2014'}</dd>
    <dt>Interval</dt><dd>${hb.interval ? hb.interval + ' min' : '\u2014'}</dd>
    <dt>Status</dt><dd>${hb.lastStatus || '\u2014'}</dd>
    <dt>Duration</dt><dd>${hb.lastDuration ? hb.lastDuration + 's' : '\u2014'}</dd>
    <dt>Failures</dt><dd>${hb.consecutiveFailures ?? 0}</dd>
    <dt>Repos</dt><dd>${repos}</dd>
  `;

  roundInfo.textContent = `Round ${hb.round ?? '?'} · Last run: ${hb.lastStatus || 'N/A'} (${hb.lastDuration ?? '?'}s)`;
}

// ── Logs ─────────────────────────────────────────────────
function updateLogUI(entries) {
  const el = document.getElementById('log-entries');
  if (!entries || entries.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted)">No log entries yet today.</p>';
    return;
  }
  el.innerHTML = entries.slice(-50).reverse().map(e => {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '?';
    const icon = e.exitCode === 0 ? '✅' : '❌';
    const metrics = e.metrics ? ` [issues=${e.metrics.issuesClosed||0} prs=${e.metrics.prsMerged||0}]` : '';
    return `<div class="log-entry">${icon} ${time} Round ${e.round||'?'} (${e.duration||'?'}s)${metrics}</div>`;
  }).join('');
}

// ── Repos ────────────────────────────────────────────────
function updateReposUI(repos) {
  const grid = document.getElementById('repos-grid');
  if (!repos || repos.length === 0) {
    grid.innerHTML = '<div class="repo-card" style="color:var(--text-muted);text-align:center;padding:3rem;">No repo data available</div>';
    return;
  }

  grid.innerHTML = repos.map(r => {
    const focus = r.focus || 'No focus set';
    const issues = r.openIssues !== null ? r.openIssues : '—';
    const commit = r.lastCommit ? r.lastCommit.message : '—';
    const sha = r.lastCommit ? r.lastCommit.sha : '';
    const squadBadge = r.hasSquad ? '<span class="badge squad">squad</span>' : '';

    return `
      <div class="repo-card">
        <div class="repo-header">
          <span class="repo-emoji">${r.emoji}</span>
          <span class="repo-name">${r.label}</span>
          ${squadBadge}
        </div>
        <div class="repo-focus">${escapeHtml(focus)}</div>
        <div class="repo-meta">
          <span class="label">Issues</span> ${issues} open<br>
          <span class="label">Commit</span> <code>${sha}</code> ${escapeHtml(commit)}
        </div>
        <a class="repo-link" href="https://github.com/${r.github}" target="_blank" rel="noopener">
          github.com/${r.github} ↗
        </a>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Polling ──────────────────────────────────────────────
async function pollHeartbeat() {
  try {
    const res = await fetch('/api/heartbeat');
    if (res.ok) {
      updateHeartbeatUI(await res.json());
      setConnected(true);
    }
  } catch { setConnected(false); }
}

async function pollLogs() {
  try {
    const res = await fetch('/api/logs');
    if (res.ok) updateLogUI(await res.json());
  } catch { /* silent */ }
}

async function pollRepos() {
  try {
    const res = await fetch('/api/repos');
    if (res.ok) updateReposUI(await res.json());
  } catch { /* silent */ }
}

// Start all polling loops
pollHeartbeat();
pollLogs();
pollRepos();
setInterval(pollHeartbeat, HEARTBEAT_POLL);
setInterval(pollLogs, LOG_POLL);
setInterval(pollRepos, REPOS_POLL);

console.log('[FFS Monitor] Dashboard online — polling heartbeat, logs, repos');
