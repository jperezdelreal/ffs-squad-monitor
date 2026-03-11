/**
 * Ralph Hero component — prominent heartbeat status.
 * Animated pulse ring, key metrics, session stats, round duration trend.
 */
import { fetchHeartbeat, fetchTimeline } from '../lib/api.js';
import { timeAgo, formatDuration } from '../lib/util.js';

// Track round durations for trend analysis
let recentDurations = [];

export async function refreshHeartbeat() {
  const [hb, timeline] = await Promise.all([
    fetchHeartbeat(),
    fetchTimeline(),
  ]);
  if (hb) renderRalphHero(hb, timeline);
}

function renderRalphHero(hb, timeline) {
  const ring = document.getElementById('ralph-ring');
  const statusLabel = document.getElementById('ralph-status');
  const modeBadge = document.getElementById('ralph-mode');
  const roundEl = document.getElementById('ralph-round');
  const ageEl = document.getElementById('ralph-age');
  const durationEl = document.getElementById('ralph-duration');
  const intervalEl = document.getElementById('ralph-interval');
  const sessionStats = document.getElementById('ralph-session-stats');
  const trendEl = document.getElementById('ralph-trend');

  // Determine ring state
  const stateMap = { idle: 'alive', running: 'running', error: 'error', offline: 'offline' };
  const ringState = stateMap[hb.status] || 'offline';
  ring.className = `ralph-heartbeat-ring ${ringState}`;

  // Status label
  const statusText = hb.status ? hb.status.charAt(0).toUpperCase() + hb.status.slice(1) : 'Unknown';
  statusLabel.textContent = `Ralph — ${statusText}`;

  // Mode badge (determine from time of day)
  const hour = new Date().getHours();
  const isNight = hour < 7 || hour >= 22;
  modeBadge.textContent = isNight ? '🌙 Night' : '☀️ Day';
  modeBadge.style.borderColor = isNight ? 'var(--purple)' : 'var(--yellow)';
  modeBadge.style.color = isNight ? 'var(--purple)' : 'var(--yellow)';

  // Key metrics
  roundEl.textContent = hb.round ?? '—';
  ageEl.textContent = timeAgo(hb.timestamp);
  durationEl.textContent = hb.lastDuration != null ? `${hb.lastDuration}s` : '—';
  intervalEl.textContent = hb.interval ? `${hb.interval}m` : '—';

  // Session stats from timeline
  if (timeline?.summary) {
    const s = timeline.summary;
    sessionStats.innerHTML = `
      <span>📋 ${s.total} rounds</span>
      <span>✅ ${s.success} ok</span>
      <span>❌ ${s.error} failed</span>
      <span>⏱ avg ${formatDuration(Math.round(s.avgDuration))}</span>
    `;
  }

  // Round duration trend
  if (timeline?.rounds) {
    const durations = timeline.rounds
      .map(r => r.duration)
      .filter(d => d > 0);

    if (durations.length >= 3) {
      const recent = durations.slice(-5);
      const older = durations.slice(-10, -5);

      if (older.length > 0) {
        const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
        const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
        const pctChange = ((avgRecent - avgOlder) / avgOlder * 100).toFixed(0);

        if (Math.abs(pctChange) < 5) {
          trendEl.innerHTML = `<span class="trend-flat">→ Stable round duration</span>`;
        } else if (pctChange > 0) {
          trendEl.innerHTML = `<span class="trend-up">↑ ${pctChange}% slower</span>`;
        } else {
          trendEl.innerHTML = `<span class="trend-down">↓ ${Math.abs(pctChange)}% faster</span>`;
        }
      } else {
        trendEl.textContent = '';
      }
    } else {
      trendEl.textContent = '';
    }
  }
}
