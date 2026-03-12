/**
 * Timeline component — swim-lane visualization.
 * Shows agent activity as horizontal bars, color-coded by outcome,
 * with expandable round details on click.
 */
import { fetchTimeline } from '../lib/api.js';
import { formatDuration, escapeHtml } from '../lib/util.js';

const STORAGE_KEY = 'ffs-timeline-limit';
const LIMIT_OPTIONS = [10, 20, 30, 50, 'All'];
const DEFAULT_LIMIT = 10;

let expandedRoundId = null;
let cachedData = null;

function getLimit() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'All') return 'All';
  const n = parseInt(stored, 10);
  return LIMIT_OPTIONS.includes(n) ? n : DEFAULT_LIMIT;
}

function setLimit(value) {
  localStorage.setItem(STORAGE_KEY, value);
}

export async function refreshTimeline() {
  const data = await fetchTimeline();
  if (data?.error) {
    renderTimelineError();
    return;
  }
  if (!data) return;
  cachedData = data;
  renderTimeline(data);
}

function renderTimelineError() {
  const container = document.getElementById('timeline');
  if (!container) return;
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-message">Could not load timeline data</div>
      <button class="retry-btn" onclick="window.__retryTimeline()">Retry</button>
    </div>
  `;
}

window.__retryTimeline = () => {
  refreshTimeline();
};

export function initTimeline() {
  const container = document.getElementById('timeline');
  if (!container) return;
  container.addEventListener('click', handleTimelineClick);

  const select = document.getElementById('timeline-limit');
  if (select) {
    select.value = String(getLimit());
    select.addEventListener('change', () => {
      setLimit(select.value);
      if (cachedData) renderTimeline(cachedData);
    });
  }
}

function handleTimelineClick(e) {
  const bar = e.target.closest('[data-round-id]');
  if (!bar) return;

  const roundId = bar.dataset.roundId;
  expandedRoundId = expandedRoundId === roundId ? null : roundId;

  // Update active state on all bars
  const allBars = document.querySelectorAll('.swim-bar');
  allBars.forEach(b => b.classList.toggle('active', b.dataset.roundId === expandedRoundId));

  // Toggle detail panel
  const detailPanel = document.getElementById('timeline-detail');
  if (expandedRoundId && bar._roundData) {
    renderDetail(detailPanel, bar._roundData);
    detailPanel.classList.add('open');
  } else if (detailPanel) {
    detailPanel.classList.remove('open');
  }
}

function renderTimeline(data) {
  const container = document.getElementById('timeline');
  if (!data.rounds || data.rounds.length === 0) {
    container.innerHTML = '<p class="empty-state">No round data yet.</p>';
    return;
  }

  const limit = getLimit();
  const allRounds = data.rounds;
  const rounds = limit === 'All' ? allRounds : allRounds.slice(-limit);
  const agents = [...new Set(rounds.map(r => r.agent))];

  // Recompute summary for visible rounds
  const summary = {
    total: rounds.length,
    success: rounds.filter(r => r.outcome === 'success').length,
    error: rounds.filter(r => r.outcome !== 'success').length,
    avgDuration: rounds.length > 0
      ? rounds.reduce((s, r) => s + r.duration, 0) / rounds.length
      : 0,
    maxDuration: rounds.reduce((m, r) => Math.max(m, r.duration), 0) || 1,
  };

  const maxDur = summary.maxDuration || 1;

  // Group rounds by agent for swim lanes
  const lanes = new Map();
  for (const agent of agents) {
    lanes.set(agent, rounds.filter(r => r.agent === agent));
  }

  const failRate = summary.total > 0
    ? Math.round((summary.error / summary.total) * 100)
    : 0;

  let html = `
    <div class="timeline-summary">
      <span class="tl-stat"><strong>${summary.total}</strong> rounds</span>
      <span class="tl-stat tl-success"><span class="dot green"></span> ${summary.success} ok</span>
      <span class="tl-stat tl-error"><span class="dot red"></span> ${summary.error} failed</span>
      <span class="tl-stat">avg ${formatDuration(Math.round(summary.avgDuration))}</span>
      <span class="tl-stat ${failRate > 20 ? 'text-red' : ''}">${failRate}% fail</span>
    </div>
  `;

  // Swim lanes per agent
  for (const [agent, agentRounds] of lanes) {
    html += `<div class="swim-lane">`;
    html += `<div class="swim-lane-label">${escapeHtml(agent)}</div>`;
    html += `<div class="swim-lane-track">`;

    agentRounds.forEach((r, i) => {
      const widthPct = Math.max(2, (r.duration / maxDur) * 100);
      const outcomeClass = r.outcome === 'success' ? 'bar-success' : 'bar-error';
      const roundId = `${r.agent}-${i}`;
      const isActive = expandedRoundId === roundId ? ' active' : '';
      const time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '?';
      const title = `Round ${r.round} - ${r.outcome} (${formatDuration(Math.round(r.duration))}) at ${time}`;

      html += `<div class="swim-bar ${outcomeClass}${isActive}" data-round-id="${roundId}" title="${escapeHtml(title)}" style="width:${widthPct.toFixed(1)}%">`;
      html += `<span class="swim-bar-label">R${r.round}</span>`;
      html += `</div>`;
    });

    html += `</div></div>`;
  }

  // Time axis
  const firstTs = rounds[0]?.timestamp;
  const lastTs = rounds[rounds.length - 1]?.timestamp;
  if (firstTs && lastTs) {
    const startTime = new Date(firstTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    html += `<div class="timeline-axis"><span>${startTime}</span><span>duration scaled</span><span>${endTime}</span></div>`;
  }

  // Detail panel
  html += `<div id="timeline-detail" class="timeline-detail ${expandedRoundId ? 'open' : ''}"></div>`;

  container.innerHTML = html;

  // Attach round data to bar DOM elements for click handler
  container.querySelectorAll('.swim-lane').forEach(laneEl => {
    const agentName = laneEl.querySelector('.swim-lane-label')?.textContent;
    const agentRounds = lanes.get(agentName) || [];
    laneEl.querySelectorAll('.swim-bar').forEach((barEl, idx) => {
      if (agentRounds[idx]) barEl._roundData = agentRounds[idx];
    });
  });

  // Re-render expanded detail if still active
  if (expandedRoundId) {
    const activeBar = container.querySelector(`[data-round-id="${expandedRoundId}"]`);
    const detailPanel = document.getElementById('timeline-detail');
    if (activeBar?._roundData && detailPanel) {
      renderDetail(detailPanel, activeBar._roundData);
    }
  }
}

function renderDetail(panel, round) {
  if (!panel) return;
  const time = round.timestamp ? new Date(round.timestamp).toLocaleString() : 'Unknown';
  const outcomeIcon = round.outcome === 'success' ? '✅' : '❌';
  const m = round.metrics || {};

  panel.innerHTML = `
    <div class="detail-header">
      <span class="detail-title">${outcomeIcon} Round ${round.round}</span>
      <span class="detail-agent">${escapeHtml(round.agent)}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">Time</span><span>${time}</span></div>
      <div class="detail-item"><span class="detail-label">Duration</span><span>${formatDuration(Math.round(round.duration))}</span></div>
      <div class="detail-item"><span class="detail-label">Status</span><span>${round.status || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">Exit Code</span><span class="${round.exitCode !== 0 ? 'text-red' : ''}">${round.exitCode}</span></div>
      <div class="detail-item"><span class="detail-label">Phase</span><span>${round.phase || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">Failures</span><span class="${round.consecutiveFailures > 0 ? 'text-red' : ''}">${round.consecutiveFailures}</span></div>
    </div>
    <div class="detail-metrics">
      <span class="detail-label">Metrics</span>
      <div class="detail-metrics-row">
        <span>PRs merged: <strong>${m.prsMerged ?? 0}</strong></span>
        <span>PRs opened: <strong>${m.prsOpened ?? 0}</strong></span>
        <span>Issues closed: <strong>${m.issuesClosed ?? 0}</strong></span>
        <span>Commits: <strong>${m.commitsCount ?? 0}</strong></span>
      </div>
    </div>
  `;
}
