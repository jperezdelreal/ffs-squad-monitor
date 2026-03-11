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

      // ── Log helpers ──────────────────────────────────────
      function listLogFiles() {
        try {
          if (!fs.existsSync(logsDir)) return [];
          return fs.readdirSync(logsDir)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => {
              const match = f.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.jsonl$/);
              return match ? { file: f, agent: match[1], date: match[2] } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date));
        } catch { return []; }
      }

      function parseLogEntry(line, agent) {
        try {
          const entry = JSON.parse(line);
          entry._agent = agent;
          entry._level = entry.exitCode === 0 ? 'info' : 'error';
          if (entry.consecutiveFailures > 0 && entry.exitCode === 0) entry._level = 'warn';
          return entry;
        } catch { return null; }
      }

      function readLogEntries(agent, date) {
        const filename = `${agent}-${date}.jsonl`;
        const filePath = path.join(logsDir, filename);
        try {
          if (!fs.existsSync(filePath)) return [];
          const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
          if (!raw.trim()) return [];
          return raw.trim().split('\n')
            .map(line => parseLogEntry(line, agent))
            .filter(Boolean);
        } catch { return []; }
      }

      // List available log files (for date/agent pickers)
      server.middlewares.use('/api/logs/files', (req, res) => {
        const files = listLogFiles();
        const agents = [...new Set(files.map(f => f.agent))];
        const dates = [...new Set(files.map(f => f.date))];
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ agents, dates, files }));
      });

      // SSE endpoint — streams new log entries in real time
      server.middlewares.use('/api/logs/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const url = new URL(req.url, `http://${req.headers.host}`);
        const sinceParam = url.searchParams.get('since');
        const sinceTs = sinceParam || null;

        const fileSizes = new Map();

        function scanAndSend() {
          try {
            if (!fs.existsSync(logsDir)) return;
            const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.jsonl'));
            for (const file of files) {
              const filePath = path.join(logsDir, file);
              const match = file.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.jsonl$/);
              if (!match) continue;
              // Skip files whose date is before ?since= date portion
              if (sinceTs && match[2] < sinceTs.slice(0, 10)) continue;
              const agent = match[1];
              let stat;
              try { stat = fs.statSync(filePath); } catch { continue; }
              const prevSize = fileSizes.get(file) || 0;
              if (stat.size > prevSize) {
                // Read only new bytes
                const fd = fs.openSync(filePath, 'r');
                const buf = Buffer.alloc(stat.size - prevSize);
                fs.readSync(fd, buf, 0, buf.length, prevSize);
                fs.closeSync(fd);
                const newContent = buf.toString('utf-8').replace(/^\uFEFF/, '');
                const lines = newContent.trim().split('\n').filter(l => l.trim());
                for (const line of lines) {
                  const entry = parseLogEntry(line, agent);
                  if (entry) {
                    if (sinceTs && entry.timestamp && entry.timestamp < sinceTs) continue;
                    res.write(`data: ${JSON.stringify(entry)}\n\n`);
                  }
                }
              }
              fileSizes.set(file, stat.size);
            }
          } catch { /* directory gone or unreadable */ }
        }

        // Debounce wrapper for fs.watch events (~150ms)
        let debounceTimer = null;
        function debouncedScan() {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(scanAndSend, 150);
        }

        // Send all existing entries on connect
        scanAndSend();

        // Watch for new entries
        let watcher;
        try {
          if (fs.existsSync(logsDir)) {
            watcher = fs.watch(logsDir, { persistent: false }, () => debouncedScan());
            watcher.on('error', () => {});
          }
        } catch { /* no watcher */ }

        // Keepalive ping every 15s
        const keepalive = setInterval(() => {
          try { res.write(': keepalive\n\n'); } catch { /* closed */ }
        }, 15000);

        req.on('close', () => {
          clearInterval(keepalive);
          if (debounceTimer) clearTimeout(debounceTimer);
          if (watcher) watcher.close();
        });
      });

      // ── Timeline endpoint ────────────────────────────────
      server.middlewares.use('/api/timeline', (req, res) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          const logFiles = listLogFiles().filter(f => f.date === date);
          let entries = [];
          for (const f of logFiles) {
            entries = entries.concat(readLogEntries(f.agent, f.date));
          }
          entries.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

          const agents = [...new Set(entries.map(e => e._agent))];
          const rounds = entries.map(e => ({
            agent: e._agent,
            round: e.round,
            timestamp: e.timestamp,
            duration: e.duration ?? 0,
            outcome: e.exitCode === 0 ? 'success' : 'error',
            exitCode: e.exitCode,
            status: e.status,
            phase: e.phase,
            consecutiveFailures: e.consecutiveFailures ?? 0,
            metrics: e.metrics || {},
          }));

          const successes = rounds.filter(r => r.outcome === 'success').length;
          const errors = rounds.filter(r => r.outcome === 'error').length;
          const durations = rounds.map(r => r.duration).filter(d => d > 0);
          const avgDuration = durations.length > 0
            ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
            : 0;
          const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

          const hb = getHeartbeatResponse();

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            date,
            agents,
            rounds,
            heartbeat: {
              status: hb.status,
              round: hb.round,
              lastStatus: hb.lastStatus,
            },
            summary: {
              total: rounds.length,
              success: successes,
              error: errors,
              avgDuration,
              maxDuration,
            },
          }));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to build timeline' }));
        }
      });

      // Structured logs — supports ?date=YYYY-MM-DD&agent=name query params
      server.middlewares.use('/api/logs', (req, res) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          const agentFilter = url.searchParams.get('agent');

          const logFiles = listLogFiles().filter(f => f.date === date);
          let entries = [];
          for (const f of logFiles) {
            if (agentFilter && f.agent !== agentFilter) continue;
            entries = entries.concat(readLogEntries(f.agent, f.date));
          }
          // Sort by timestamp
          entries.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(entries));
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
