import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { REPOS } from '../config.js';
import { githubFetch, handleGitHubError } from '../lib/github-client.js';

function readNowMd(repoDir) {
  const p = path.join(repoDir, '.squad', 'identity', 'now.md');
  try {
    let raw = fs.readFileSync(p, 'utf-8');
    // Strip YAML frontmatter if present
    if (raw.startsWith('---')) {
      const end = raw.indexOf('---', 3);
      if (end !== -1) raw = raw.slice(end + 3);
    }
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    return lines[0]?.trim().slice(0, 140) || 'No focus set';
  } catch { return null; }
}

async function getOpenIssueCount(ghRepo) {
  try {
    const [owner, name] = ghRepo.split('/');
    const { data } = await githubFetch(
      `/repos/${owner}/${name}/issues?state=open&per_page=1`,
    );
    // Use the array length as a rough count; for accurate count we'd parse Link header
    // but for this dashboard, re-fetch with higher limit
    const { data: issues } = await githubFetch(
      `/repos/${owner}/${name}/issues?state=open&per_page=50`,
    );
    return issues.filter(i => !i.pull_request).length;
  } catch { return null; }
}

function getLastCommit(repoDir) {
  try {
    const out = execSync(
      `git -C "${repoDir}" log -1 --format="%H %s" --date=short`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const trimmed = out.trim();
    const sha = trimmed.slice(0, 7);
    const msg = trimmed.slice(41); // skip full 40-char SHA + space
    return { sha, message: msg || trimmed };
  } catch { return null; }
}

/**
 * @openapi
 * /api/repos:
 *   get:
 *     summary: Get monitored repositories
 *     description: Returns status info for each monitored repo including squad presence, current focus from now.md, open issue count, and latest commit.
 *     tags: [Repos]
 *     responses:
 *       200:
 *         description: Array of repository status objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Repo'
 *       500:
 *         description: Failed to fetch repos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default async function reposRoute(req, res) {
  try {
    const results = [];
    for (const repo of REPOS) {
      const hasSquad = fs.existsSync(path.join(repo.dir, '.squad'));
      const focus = readNowMd(repo.dir);
      const openIssues = await getOpenIssueCount(repo.github);
      const lastCommit = getLastCommit(repo.dir);
      results.push({
        id: repo.id,
        emoji: repo.emoji,
        label: repo.label,
        github: repo.github,
        hasSquad,
        focus,
        openIssues,
        lastCommit,
      });
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(results));
  } catch (err) {
    if (handleGitHubError(res, err)) return;
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to fetch repos' }));
  }
}
