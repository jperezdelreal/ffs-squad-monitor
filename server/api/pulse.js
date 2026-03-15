import fs from 'fs';
import { config, REPOS, SQUAD_AGENTS } from '../config.js';
import { githubFetch, handleGitHubError } from '../lib/github-client.js';
import { cacheManager } from '../lib/cache-manager.js';

async function fetchPulseData() {
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

  return {
    prsMergedToday,
    issuesClosedToday,
    activeAgents,
    totalAgents: Object.keys(SQUAD_AGENTS).length,
  };
}

/**
 * @openapi
 * /api/pulse:
 *   get:
 *     summary: Get daily activity pulse
 *     description: Returns today's activity counts — PRs merged, issues closed, active agents, and total agent roster size. Cached for 10 seconds.
 *     tags: [Pulse]
 *     responses:
 *       200:
 *         description: Daily pulse data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pulse'
 *       500:
 *         description: Failed to compute pulse
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default async function pulseRoute(req, res) {
  try {
    const cacheKey = 'pulse'
    const tier = 'hot' // 10s TTL for frequently changing data
    
    const pulseData = await cacheManager.get(cacheKey, tier, fetchPulseData)

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(pulseData));
  } catch (err) {
    if (handleGitHubError(res, err)) return;
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to compute pulse' }));
  }
}
