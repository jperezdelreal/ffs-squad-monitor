/**
 * Cross-Repo Issue Board — all open issues grouped by priority.
 * P0=red, P1=orange, P2=yellow, P3=gray. Clickable links to GitHub.
 */
import { fetchIssues } from '../lib/api.js';
import { escapeHtml } from '../lib/util.js';

export async function refreshBoard() {
  const issues = await fetchIssues();
  if (!issues) return;
  renderBoard(issues);
}

function renderBoard(issues) {
  const container = document.getElementById('board');
  const countEl = document.getElementById('board-count');

  if (!Array.isArray(issues)) {
    container.innerHTML = '<div class="empty-state">Failed to load issues</div>';
    return;
  }

  if (countEl) countEl.textContent = `(${issues.length})`;

  // Group by priority
  const groups = { 0: [], 1: [], 2: [], 3: [] };
  for (const issue of issues) {
    const p = Math.min(Math.max(issue.priority, 0), 3);
    groups[p].push(issue);
  }

  const priorityLabels = {
    0: { label: 'P0 — Critical', cls: 'p0' },
    1: { label: 'P1 — High',     cls: 'p1' },
    2: { label: 'P2 — Medium',   cls: 'p2' },
    3: { label: 'P3 — Low',      cls: 'p3' },
  };

  let html = '';
  for (const [p, meta] of Object.entries(priorityLabels)) {
    const items = groups[p] || [];
    html += `
      <div class="board-column ${meta.cls}">
        <div class="board-column-header">
          ${meta.label}
          <span class="board-column-count">(${items.length})</span>
        </div>
        ${items.length === 0
          ? '<div class="board-empty">No issues</div>'
          : items.map(renderIssueCard).join('')
        }
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderIssueCard(issue) {
  const assignee = issue.assignees?.[0] || '';
  const prBadge = issue.prStatus
    ? `<span class="board-issue-pr ${issue.prStatus === 'MERGED' ? 'merged' : 'open'}">${issue.prStatus === 'MERGED' ? 'merged' : 'PR'}</span>`
    : '';

  return `
    <a class="board-issue" href="${escapeHtml(issue.url)}" target="_blank" rel="noopener" title="${escapeHtml(issue.title)}">
      <div class="board-issue-title">${escapeHtml(issue.title)}</div>
      <div class="board-issue-meta">
        <span class="board-issue-repo">${issue.repoEmoji}</span>
        <span class="board-issue-number">#${issue.number}</span>
        ${prBadge}
        ${assignee ? `<span class="board-issue-assignee">@${escapeHtml(assignee)}</span>` : ''}
      </div>
    </a>
  `;
}
