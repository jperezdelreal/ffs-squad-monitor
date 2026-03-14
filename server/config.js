import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve GitHub token: env var first, then gh CLI fallback
function resolveGitHubToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  try {
    const token = execSync('gh auth token', {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (token) return token;
  } catch {
    // gh CLI not available or not authenticated
  }
  return null;
}

const githubToken = resolveGitHubToken();

export const config = {
  // Server configuration
  port: process.env.PORT || 3001,
  
  // Paths
  ffsRoot: process.env.FFS_ROOT || path.resolve(__dirname, '..', '..', 'FirstFrameStudios'),
  
  get heartbeatPath() {
    return process.env.FFS_HEARTBEAT_PATH || path.join(this.ffsRoot, 'tools', '.ralph-heartbeat.json');
  },
  
  get logsDir() {
    return path.join(this.ffsRoot, 'tools', 'logs');
  },
  
  get orchestrationLogDir() {
    return path.join(this.ffsRoot, '.squad', 'orchestration-log');
  },
  
  // Cache TTL (60s per #122 - GitHub API rate limiting)
  cacheTTL: 60_000,

  // GitHub authentication
  githubToken,
};

// ============================================================================
// CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================================================
// REPOS and SQUAD_AGENTS are defined here and ONLY here.
// All backend routes, frontend components, and build scripts import from this file.
// To add/modify a repo or agent, edit this file and restart the server.
//
// Frontend fetches config via /api/config endpoint (see server/api/config.js)
// Vite build imports directly at build time (see vite.config.js)
// ============================================================================

// Repository definitions — FFS games only (SS monitors itself + downstream via safety-net.yml)
export const REPOS = [
  { id: 'flora',             emoji: '🌿', label: 'Flora',          github: 'jperezdelreal/flora',          color: '#ef4444', dir: path.resolve(__dirname, '..', '..', 'flora') },
  { id: 'ComeRosquillas',    emoji: '🍩', label: 'ComeRosquillas', github: 'jperezdelreal/ComeRosquillas', color: '#f59e0b', dir: path.resolve(__dirname, '..', '..', 'ComeRosquillas') },
  { id: 'pixel-bounce',      emoji: '🎮', label: 'Pixel Bounce',   github: 'jperezdelreal/pixel-bounce',   color: '#8b5cf6', dir: path.resolve(__dirname, '..', '..', 'pixel-bounce') },
];

// Squad agent roster
export const SQUAD_AGENTS = {
  // Hub (FirstFrameStudios)
  solo:    { emoji: '🏗️', role: 'Lead / Architect',      color: '#58a6ff', repo: 'FirstFrameStudios' },
  jango:   { emoji: '⚙️', role: 'Tool Engineer',          color: '#8b949e', repo: 'FirstFrameStudios' },
  mace:    { emoji: '📊', role: 'Producer',                color: '#e3b341', repo: 'FirstFrameStudios' },
  // ComeRosquillas
  moe:     { emoji: '🏗️', role: 'Lead',                   color: '#58a6ff', repo: 'ComeRosquillas' },
  barney:  { emoji: '🔧', role: 'Game Dev',                color: '#f0883e', repo: 'ComeRosquillas' },
  lenny:   { emoji: '⚛️', role: 'UI Dev',                  color: '#bc8cff', repo: 'ComeRosquillas' },
  nelson:  { emoji: '🧪', role: 'Tester',                  color: '#da3633', repo: 'ComeRosquillas' },
  // Flora
  oak:     { emoji: '🏗️', role: 'Lead / Chief Architect',  color: '#56d364', repo: 'flora' },
  brock:   { emoji: '🔧', role: 'Web Engine Dev',          color: '#f0883e', repo: 'flora' },
  erika:   { emoji: '⚔️', role: 'Systems Dev',             color: '#f85149', repo: 'flora' },
  misty:   { emoji: '⚛️', role: 'Web UI Dev',              color: '#bc8cff', repo: 'flora' },
  sabrina: { emoji: '🎨', role: 'Procedural Art Director', color: '#d29922', repo: 'flora' },
  // Monitor (ffs-squad-monitor)
  ripley:  { emoji: '🏗️', role: 'Lead',                   color: '#58a6ff', repo: 'ffs-squad-monitor' },
  dallas:  { emoji: '⚛️', role: 'Frontend Dev',            color: '#bc8cff', repo: 'ffs-squad-monitor' },
  lambert: { emoji: '🔧', role: 'Backend Dev',             color: '#f0883e', repo: 'ffs-squad-monitor' },
  kane:    { emoji: '🧪', role: 'Tester',                  color: '#da3633', repo: 'ffs-squad-monitor' },
  // Shared
  scribe:  { emoji: '📋', role: 'Session Logger',          color: '#656d76', repo: 'all' },
  ralph:   { emoji: '🔄', role: 'Work Monitor',            color: '#58a6ff', repo: 'all' },
};
