import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { REPOS } from '../config.js';

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

function getOpenIssueCount(ghRepo) {
  try {
    const out = execSync(
      `gh issue list --repo ${ghRepo} --state open --json number --limit 50`,
      { timeout: 8000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(out).length;
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

export default function reposRoute(req, res) {
  const results = REPOS.map(repo => {
    const hasSquad = fs.existsSync(path.join(repo.dir, '.squad'));
    const focus = readNowMd(repo.dir);
    const openIssues = getOpenIssueCount(repo.github);
    const lastCommit = getLastCommit(repo.dir);
    return {
      id: repo.id,
      emoji: repo.emoji,
      label: repo.label,
      github: repo.github,
      hasSquad,
      focus,
      openIssues,
      lastCommit,
    };
  });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(results));
}
