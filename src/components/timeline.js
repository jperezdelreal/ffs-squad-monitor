/**
 * Timeline component.
 * Visual timeline of recent round outcomes — a compact horizontal view
 * showing success/failure streaks at a glance.
 */
import { fetchLogs } from '../lib/api.js';

const MAX_DOTS = 30;

export async function refreshTimeline() {
  const entries = await fetchLogs();
  if (!entries) return;
  renderTimeline(entries);
}

function renderTimeline(entries) {
  const container = document.getElementById('timeline');
  if (!entries || entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No round data yet.</p>';
    return;
  }

  const recent = entries.slice(-MAX_DOTS);
  const totalRounds = entries.length;
  const successes = entries.filter(e => e.exitCode === 0).length;
  const failRate = totalRounds > 0 ? ((totalRounds - successes) / totalRounds * 100).toFixed(0) : 0;

  const dots = recent.map(e => {
    const ok = e.exitCode === 0;
    const cls = ok ? 'timeline-dot success' : 'timeline-dot failure';
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '?';
    const title = `Round ${e.round || '?'} — ${ok ? 'Success' : 'Failed'} (${e.duration || '?'}s) at ${time}`;
    return `<span class="${cls}" title="${title}"></span>`;
  }).join('');

  container.innerHTML = `
    <div class="timeline-track">${dots}</div>
    <div class="timeline-stats">
      <span>${totalRounds} rounds today</span>
      <span>${successes} succeeded</span>
      <span class="${failRate > 20 ? 'text-red' : ''}">${failRate}% failure rate</span>
    </div>
  `;
}
