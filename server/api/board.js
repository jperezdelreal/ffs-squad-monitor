import { execSync } from 'child_process';
import { config, REPOS } from '../config.js';

const ISSUE_CACHE_TTL = config.issueCacheTTL;
let issueCache = null;
let issueCacheTime = 0;

export default function boardRoute(req, res) {
  try {
    if (issueCache && Date.now() - issueCacheTime < ISSUE_CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(issueCache));
      return;
    }

    const allIssues = [];
    for (const repo of REPOS) {
      try {
        const out = execSync(
          `gh issue list --repo ${repo.github} --state open --json number,title,labels,assignees,url,createdAt,updatedAt --limit 50`,
          { timeout: 15000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const issues = JSON.parse(out);
        for (const issue of issues) {
          // Derive priority from labels
          const labels = (issue.labels || []).map(l => l.name || l);
          let priority = 3;
          if (labels.some(l => /p0|priority.*0|critical/i.test(l))) priority = 0;
          else if (labels.some(l => /p1|priority.*1|high/i.test(l))) priority = 1;
          else if (labels.some(l => /p2|priority.*2|medium/i.test(l))) priority = 2;

          const assignees = (issue.assignees || []).map(a => a.login || a);
          // Check if there's a linked PR
          let prStatus = null;
          try {
            const prOut = execSync(
              `gh pr list --repo ${repo.github} --search "${issue.number}" --json number,state,title --limit 3`,
              { timeout: 8000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
            );
            const prs = JSON.parse(prOut);
            const linked = prs.find(pr => pr.title && pr.title.includes(`#${issue.number}`));
            if (linked) prStatus = linked.state;
          } catch { /* skip */ }

          allIssues.push({
            repo: repo.id,
            repoLabel: repo.label,
            repoEmoji: repo.emoji,
            number: issue.number,
            title: issue.title,
            url: issue.url,
            priority,
            labels,
            assignees,
            prStatus,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
          });
        }
      } catch { /* skip repo */ }
    }

    // Sort by priority then by updatedAt
    allIssues.sort((a, b) => a.priority - b.priority || (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    issueCache = allIssues;
    issueCacheTime = Date.now();

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(allIssues));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to fetch issues' }));
  }
}
