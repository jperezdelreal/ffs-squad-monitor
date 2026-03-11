import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPOS = [
  { id: 'FirstFrameStudios', emoji: '🏗️', label: 'Studio Hub', github: 'jperezdelreal/FirstFrameStudios', dir: path.resolve(__dirname, '..', 'FirstFrameStudios') },
  { id: 'ComeRosquillas',    emoji: '🍩', label: 'ComeRosquillas', github: 'jperezdelreal/ComeRosquillas', dir: path.resolve(__dirname, '..', 'ComeRosquillas') },
  { id: 'flora',             emoji: '🌿', label: 'Flora',          github: 'jperezdelreal/flora',          dir: path.resolve(__dirname, '..', 'flora') },
  { id: 'ffs-squad-monitor', emoji: '📊', label: 'Squad Monitor',  github: 'jperezdelreal/ffs-squad-monitor', dir: path.resolve(__dirname) },
];

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

function ffsApiPlugin() {
  const ffsRoot = path.resolve(__dirname, '..', 'FirstFrameStudios');
  const heartbeatPath = process.env.FFS_HEARTBEAT_PATH
    || path.join(ffsRoot, 'tools', '.ralph-heartbeat.json');
  const logsDir = path.join(ffsRoot, 'tools', 'logs');

  // Cached heartbeat state — updated via fs.watch
  let heartbeatCache = null;
  let heartbeatWatcher = null;

  function readHeartbeatFile() {
    try {
      const raw = fs.readFileSync(heartbeatPath, 'utf-8').replace(/^\uFEFF/, '');
      const data = JSON.parse(raw);
      heartbeatCache = {
        status: data.status || 'unknown',
        round: data.round ?? null,
        pid: data.pid ?? null,
        interval: data.interval ?? null,
        lastStatus: data.lastStatus || null,
        lastDuration: data.lastDuration ?? null,
        timestamp: data.timestamp || null,
        consecutiveFailures: data.consecutiveFailures ?? 0,
        repos: data.repos || [],
      };
    } catch {
      heartbeatCache = null;
    }
  }

  function startWatcher() {
    if (heartbeatWatcher) return;
    const dir = path.dirname(heartbeatPath);
    const basename = path.basename(heartbeatPath);
    try {
      // Watch the directory so we catch file creation after deletion
      heartbeatWatcher = fs.watch(dir, (eventType, filename) => {
        if (filename === basename) readHeartbeatFile();
      });
      heartbeatWatcher.on('error', () => {
        heartbeatWatcher = null;
      });
    } catch {
      // Directory doesn't exist — fall back to read-on-request
    }
  }

  function getHeartbeatResponse() {
    // If watcher isn't active, try a fresh read
    if (!heartbeatWatcher) readHeartbeatFile();
    if (!heartbeatCache) {
      return { status: 'offline' };
    }
    return heartbeatCache;
  }

  return {
    name: 'ffs-api',
    configureServer(server) {
      // Initialize heartbeat cache and file watcher
      readHeartbeatFile();
      startWatcher();

      server.middlewares.use('/api/heartbeat', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(getHeartbeatResponse()));
      });

      // Structured logs from ralph-watch
      server.middlewares.use('/api/logs', (req, res) => {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const logFile = path.join(logsDir, `ralph-${today}.jsonl`);
          if (fs.existsSync(logFile)) {
            const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
            const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(entries));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end('[]');
          }
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to read logs' }));
        }
      });

      // All repos status
      server.middlewares.use('/api/repos', (req, res) => {
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
      });
    }
  };
}

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [ffsApiPlugin()],
});
