import fs from 'fs';
import { config, REPOS, SQUAD_AGENTS } from '../config.js';
import { githubFetch, handleGitHubError } from '../lib/github-client.js';

export default async function pulseRoute(req, res) {
  try {
    let prsMergedToday = 0;
    let issuesClosedToday = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const repo of REPOS) {
      const [owner, name] = repo.github.split('/');

      try {
        const { data: prs } = await githubFetch(
          `/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=20`
        );
        prsMergedToday += prs.filter(
          pr => pr.merged_at && pr.merged_at.startsWith(today)
        ).length;
      } catch { /* skip */ }

      try {
        const { data: issues } = await githubFetch(
          `/repos/${owner}/${name}/issues?state=closed&sort=updated&direction=desc&per_page=20`
        );
        issuesClosedToday += issues.filter(
          i => !i.pull_request && i.closed_at && i.closed_at.startsWith(today)
        ).length;
      } catch { /* skip */ }
    }

    // Count active agents from today's logs
    let activeAgents = 0;
    try {
      if (fs.existsSync(config.logsDir)) {
        const files = fs.readdirSync(config.logsDir).filter(f => f.endsWith('.jsonl') && f.includes(today));
        activeAgents = files.length;
      }
    } catch { /* skip */ }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      prsMergedToday,
      issuesClosedToday,
      activeAgents,
      totalAgents: Object.keys(SQUAD_AGENTS).length,
    }));
  } catch (err) {
    if (handleGitHubError(res, err)) return;
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to compute pulse' }));
  }
}
