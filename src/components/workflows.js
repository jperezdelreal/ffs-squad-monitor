/**
 * Workflows component.
 * Shows GitHub Actions workflow run status for each repo
 * with color-coded badges and links to GitHub.
 */
import { fetchWorkflows } from '../lib/api.js';
import { escapeHtml, timeAgo } from '../lib/util.js';

export async function refreshWorkflows() {
  const data = await fetchWorkflows();
  if (!data) return;
  renderWorkflows(data);
}

/**
 * Map workflow conclusion/status to display info.
 */
function getStatusInfo(status, conclusion) {
  if (status === 'in_progress' || status === 'queued') {
    return { label: 'In Progress', cls: 'wf-in-progress', icon: '🔄' };
  }
  switch (conclusion) {
    case 'success':    return { label: 'Success',   cls: 'wf-success',   icon: '✅' };
    case 'failure':    return { label: 'Failed',    cls: 'wf-failure',   icon: '❌' };
    case 'cancelled':  return { label: 'Cancelled', cls: 'wf-cancelled', icon: '⏹️' };
    case 'skipped':    return { label: 'Skipped',   cls: 'wf-skipped',   icon: '⏭️' };
    default:           return { label: status || 'Unknown', cls: 'wf-unknown', icon: '❓' };
  }
}

function renderWorkflows(repos) {
  const container = document.getElementById('workflows-grid');
  if (!repos || repos.length === 0) {
    container.innerHTML = '<div class="empty-state">No workflow data available</div>';
    return;
  }

  container.innerHTML = repos.map(repo => {
    if (repo.workflows.length === 0) {
      const msg = repo.error ? escapeHtml(repo.error) : 'No workflows found';
      return `
        <div class="wf-repo-card">
          <div class="wf-repo-header">
            <span class="repo-emoji">${repo.emoji}</span>
            <span class="repo-name">${escapeHtml(repo.label)}</span>
          </div>
          <p class="wf-empty">${msg}</p>
        </div>`;
    }

    const rows = repo.workflows.map(wf => {
      const info = getStatusInfo(wf.status, wf.conclusion);
      const ago = timeAgo(wf.updatedAt);
      const branch = wf.branch ? escapeHtml(wf.branch) : '';
      const url = wf.url || `https://github.com/${repo.github}/actions`;

      return `
        <a class="wf-run" href="${url}" target="_blank" rel="noopener" title="${escapeHtml(wf.workflow)} on ${branch} — ${info.label}">
          <span class="wf-badge ${info.cls}">${info.icon} ${info.label}</span>
          <span class="wf-name">${escapeHtml(wf.workflow)}</span>
          <span class="wf-meta">${branch} · ${ago}</span>
        </a>`;
    }).join('');

    return `
      <div class="wf-repo-card">
        <div class="wf-repo-header">
          <span class="repo-emoji">${repo.emoji}</span>
          <span class="repo-name">${escapeHtml(repo.label)}</span>
          <a class="wf-actions-link" href="https://github.com/${repo.github}/actions" target="_blank" rel="noopener">Actions ↗</a>
        </div>
        <div class="wf-runs">${rows}</div>
      </div>`;
  }).join('');
}
