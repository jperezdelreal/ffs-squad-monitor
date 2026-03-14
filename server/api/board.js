import { config, REPOS } from '../config.js'
import { githubFetch, handleGitHubError } from '../lib/github-client.js'

const ISSUE_CACHE_TTL = 60_000; // 60 seconds per #122
let issueCache = null;
let issueCacheTime = 0;

/**
 * Fetch issues across all repos with given state.
 * Shared by HTTP handler and data poller.
 */
export async function fetchIssues(stateParam = 'open') {
  const allIssues = [];
  for (const repo of REPOS) {
    try {
      const [owner, name] = repo.github.split('/');
      const perPage = stateParam === 'all' ? 100 : 50;
      const { data: issues } = await githubFetch(
        `/repos/${owner}/${name}/issues?state=${stateParam}&per_page=${perPage}`
      );

      for (const issue of issues) {
        if (issue.pull_request) continue;

        const labels = (issue.labels || []).map(l => l.name || l);
        let priority = 3;
        if (labels.some(l => /p0|priority.*0|critical/i.test(l))) priority = 0;
        else if (labels.some(l => /p1|priority.*1|high/i.test(l))) priority = 1;
        else if (labels.some(l => /p2|priority.*2|medium/i.test(l))) priority = 2;

        const assignees = (issue.assignees || []).map(a => a.login || a);

        let prStatus = null;
        try {
          const { data: prs } = await githubFetch(
            `/repos/${owner}/${name}/pulls?state=all&per_page=5&sort=updated&direction=desc`
          );
          const linked = prs.find(pr => pr.title && pr.title.includes(`#${issue.number}`));
          if (linked) prStatus = linked.state;
        } catch { /* skip PR lookup failures */ }

        allIssues.push({
          repo: repo.id,
          repoLabel: repo.label,
          repoEmoji: repo.emoji,
          repoGithub: repo.github,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          priority,
          labels,
          assignees,
          prStatus,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
        });
      }
    } catch {
      // Skip individual repo failures
    }
  }

  allIssues.sort((a, b) => a.priority - b.priority || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return allIssues;
}

/**
 * @openapi
 * /api/issues:
 *   get:
 *     summary: Get issues across all repos
 *     description: Fetches GitHub issues from all monitored repositories, sorted by priority then update time. Includes linked PR status. Default (open) queries are cached for 60 seconds per #122.
 *     tags: [Issues]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           enum: [open, closed, all]
 *           default: open
 *         description: Filter issues by state
 *     responses:
 *       200:
 *         description: Array of issues across all repos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Issue'
 *       500:
 *         description: Failed to fetch issues
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: GitHub API rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default async function boardRoute(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const stateParam = url.searchParams.get('state') || 'open';

    if (stateParam === 'open' && issueCache && Date.now() - issueCacheTime < ISSUE_CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(issueCache));
      return;
    }

    const allIssues = await fetchIssues(stateParam);

    if (stateParam === 'open') {
      issueCache = allIssues;
      issueCacheTime = Date.now();
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(allIssues));
  } catch (err) {
    if (handleGitHubError(res, err)) return;
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to fetch issues' }));
  }
}
