/**
 * Studio Pulse — compact top-bar stats.
 * PRs merged today, issues closed today, active agents.
 */
import { fetchPulse } from '../lib/api.js';

export async function refreshPulse() {
  const data = await fetchPulse();
  if (data?.error) {
    renderPulseError();
    return;
  }
  if (!data) return;
  renderPulse(data);
}

function renderPulseError() {
  const prsEl = document.getElementById('pulse-prs');
  const issuesEl = document.getElementById('pulse-issues');
  const agentsEl = document.getElementById('pulse-agents');
  
  if (prsEl) prsEl.textContent = '—';
  if (issuesEl) issuesEl.textContent = '—';
  if (agentsEl) agentsEl.textContent = '—';
}

function renderPulse(data) {
  const prsEl = document.getElementById('pulse-prs');
  const issuesEl = document.getElementById('pulse-issues');
  const agentsEl = document.getElementById('pulse-agents');

  if (prsEl) animateValue(prsEl, data.prsMergedToday);
  if (issuesEl) animateValue(issuesEl, data.issuesClosedToday);
  if (agentsEl) agentsEl.textContent = `${data.activeAgents}/${data.totalAgents}`;
}

function animateValue(el, newValue) {
  const oldValue = parseInt(el.textContent, 10);
  if (isNaN(oldValue) || oldValue === newValue) {
    el.textContent = newValue;
    return;
  }
  el.textContent = newValue;
  el.style.transition = 'none';
  el.style.transform = 'scale(1.3)';
  el.style.color = 'var(--cyan)';
  requestAnimationFrame(() => {
    el.style.transition = 'transform 0.3s ease, color 0.5s ease';
    el.style.transform = 'scale(1)';
    el.style.color = '';
  });
}
