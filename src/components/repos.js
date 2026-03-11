/**
 * Repos grid component.
 * Renders studio repository cards with focus, issues, and last commit info.
 */
import { fetchRepos } from '../lib/api.js';
import { escapeHtml } from '../lib/util.js';

export async function refreshRepos() {
  const repos = await fetchRepos();
  if (!repos) return;
  renderRepos(repos);
}

function renderRepos(repos) {
  const grid = document.getElementById('repos-grid');
  if (!repos || repos.length === 0) {
    grid.innerHTML = '<div class="repo-card empty-state">No repo data available</div>';
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
          <span class="repo-name">${escapeHtml(r.label)}</span>
          ${squadBadge}
        </div>
        <div class="repo-focus">${escapeHtml(focus)}</div>
        <div class="repo-meta">
          <span class="label">Issues</span> ${issues} open<br>
          <span class="label">Commit</span> <code>${escapeHtml(sha)}</code> ${escapeHtml(commit)}
        </div>
        <a class="repo-link" href="https://github.com/${r.github}" target="_blank" rel="noopener">
          github.com/${r.github} ↗
        </a>
      </div>
    `;
  }).join('');
}
