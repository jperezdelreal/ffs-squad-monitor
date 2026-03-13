import fs from 'fs';
import { execSync } from 'child_process';
import { config, REPOS, SQUAD_AGENTS } from '../config.js';

export default function pulseRoute(req, res) {
  try {
    let prsMergedToday = 0;
    let issuesClosedToday = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const repo of REPOS) {
      try {
        const prOut = execSync(
          `gh pr list --repo ${repo.github} --state merged --json mergedAt --limit 20`,
          { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const prs = JSON.parse(prOut);
        prsMergedToday += prs.filter(pr => pr.mergedAt && pr.mergedAt.startsWith(today)).length;
      } catch { /* skip */ }

      try {
        const issueOut = execSync(
          `gh issue list --repo ${repo.github} --state closed --json closedAt --limit 20`,
          { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const issues = JSON.parse(issueOut);
        issuesClosedToday += issues.filter(i => i.closedAt && i.closedAt.startsWith(today)).length;
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
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to compute pulse' }));
  }
}
