/**
 * Agent Activity panel — shows squad agents with status and recent activity.
 * Color-coded by role, animated status indicators.
 */
import { fetchAgents } from '../lib/api.js';
import { timeAgo, escapeHtml } from '../lib/util.js';

export async function refreshAgents() {
  const agents = await fetchAgents();
  if (!agents) return;
  renderAgents(agents);
}

function renderAgents(agents) {
  const grid = document.getElementById('agent-grid');
  if (!agents || agents.length === 0) {
    grid.innerHTML = '<div class="empty-state">No agent data available</div>';
    return;
  }

  grid.innerHTML = agents.map(agent => {
    const statusClass = getStatusClass(agent.status);
    const activity = agent.lastActivity ? timeAgo(agent.lastActivity) : '';
    const work = agent.currentWork ? escapeHtml(agent.currentWork) : 'No activity';
    const activityLine = activity && agent.currentWork
      ? `<div class="agent-activity">${work}</div><div class="agent-timestamp">${activity}</div>`
      : `<div class="agent-activity">${agent.currentWork ? work : (activity || 'No activity')}</div>`;

    return `
      <div class="agent-card status-${statusClass}" title="${escapeHtml(agent.role)}">
        <div class="agent-avatar" style="border-color: ${agent.color}">${agent.emoji}</div>
        <div class="agent-details">
          <div class="agent-name">
            ${escapeHtml(agent.id)}
            <span class="agent-status-dot ${statusClass}"></span>
          </div>
          <div class="agent-role">${escapeHtml(agent.role)}</div>
          ${activityLine}
        </div>
      </div>
    `;
  }).join('');
}

function getStatusClass(status) {
  switch (status) {
    case 'working': return 'working';
    case 'blocked': return 'blocked';
    case 'review':  return 'review';
    default:        return 'idle';
  }
}
