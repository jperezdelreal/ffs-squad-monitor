import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { REPOS, SQUAD_AGENTS } from './server/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const orchestrationLogDir = path.join(ffsRoot, '.squad', 'orchestration-log');

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
        mode: data.mode || null,
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

      // Health check endpoint
      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'ok',
          version: '0.1.0',
          timestamp: new Date().toISOString(),
        }));
      });

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
          let date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          let logFiles = listLogFiles().filter(f => f.date === date);

          // Fallback: if no logs for requested date, use the latest available date
          if (logFiles.length === 0 && !url.searchParams.get('date')) {
            const allFiles = listLogFiles();
            if (allFiles.length > 0) {
              date = allFiles[0].date; // Already sorted newest first
              logFiles = allFiles.filter(f => f.date === date);
            }
          }
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

          // Read heartbeat for current status
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
          let date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          const agentFilter = url.searchParams.get('agent');

          let logFiles = listLogFiles().filter(f => f.date === date);
          // Fallback: if no logs for today, use latest available date
          if (logFiles.length === 0 && !url.searchParams.get('date')) {
            const allFiles = listLogFiles();
            if (allFiles.length > 0) {
              date = allFiles[0].date;
              logFiles = allFiles.filter(f => f.date === date);
            }
          }
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

      // ── Agent roster & status ─────────────────────────────
      // Parse orchestration-log files: "2026-03-11T15-33-03Z-solo.md" → { agent: "solo", timestamp: "2026-03-11T15:33:03Z" }
      function getOrchestrationActivity() {
        const activity = new Map();
        try {
          if (!fs.existsSync(orchestrationLogDir)) return activity;
          const files = fs.readdirSync(orchestrationLogDir)
            .filter(f => f.endsWith('.md'))
            .sort();
          for (const file of files) {
            // Match patterns like "2026-03-11T15-33-03Z-solo.md" or "2026-03-09T1024Z-wedge.md"
            const match = file.match(/^(\d{4}-\d{2}-\d{2}T[\d-]+Z)-(.+)\.md$/);
            if (!match) continue;
            const rawTs = match[1];
            const agentRaw = match[2].toLowerCase();
            // Normalize timestamp: "2026-03-11T15-33-03Z" → "2026-03-11T15:33:03Z"
            const ts = rawTs.replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z')
              .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z')
              .replace(/T(\d{4})Z/, (m, hhmm) => `T${hhmm.slice(0,2)}:${hhmm.slice(2)}:00Z`);
            // Extract agent name (strip compound suffixes like "jango-build-pipeline" → "jango")
            const knownAgents = Object.keys(SQUAD_AGENTS);
            const agent = knownAgents.find(a => agentRaw === a || agentRaw.startsWith(a + '-'));
            if (!agent) continue;
            // Read first meaningful line as task summary
            let task = null;
            try {
              const content = fs.readFileSync(path.join(orchestrationLogDir, file), 'utf-8');
              // Look for Task: line or Agent routed line
              const taskMatch = content.match(/\*\*Task:\*\*\s*(.+)/);
              const agentMatch = content.match(/\*\*Task[^*]*:\*\*\s*(.+)/i)
                || content.match(/^#+\s*Orchestration Log\s*[—–-]+\s*(.+)/m);
              if (taskMatch) task = taskMatch[1].trim().slice(0, 120);
              else if (agentMatch) task = agentMatch[1].trim().slice(0, 120);
              else {
                // Fallback: first non-header, non-empty line
                const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
                task = lines[0]?.replace(/\*+/g, '').trim().slice(0, 120) || null;
              }
            } catch { /* skip */ }

            // Keep latest entry per agent
            const existing = activity.get(agent);
            if (!existing || ts > existing.timestamp) {
              activity.set(agent, { timestamp: ts, task, file });
            }
          }
        } catch { /* skip */ }
        return activity;
      }

      server.middlewares.use('/api/agents', (req, res) => {
        const orchestration = getOrchestrationActivity();

        const agents = Object.entries(SQUAD_AGENTS).map(([id, meta]) => {
          let status = 'idle';
          let lastActivity = null;
          let currentWork = null;

          // 1. Check orchestration-log for agent activity
          const orch = orchestration.get(id);
          if (orch) {
            lastActivity = orch.timestamp;
            currentWork = orch.task;
            // If activity was within the last 2 hours, mark as working
            const ageMs = Date.now() - new Date(orch.timestamp).getTime();
            if (ageMs < 2 * 60 * 60 * 1000) status = 'working';
          }

          // 2. Also check JSONL logs (ralph's rounds reference agents)
          const today = new Date().toISOString().slice(0, 10);
          const logFile = path.join(logsDir, `${id}-${today}.jsonl`);
          try {
            if (fs.existsSync(logFile)) {
              const raw = fs.readFileSync(logFile, 'utf-8').replace(/^\uFEFF/, '').trim();
              if (raw) {
                const lines = raw.split('\n').filter(l => l.trim());
                const lastEntry = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;
                if (lastEntry) {
                  // Use JSONL data if more recent than orchestration-log
                  if (!lastActivity || (lastEntry.timestamp && lastEntry.timestamp > lastActivity)) {
                    lastActivity = lastEntry.timestamp;
                    currentWork = lastEntry.phase || lastEntry.status || currentWork;
                  }
                  if (lastEntry.exitCode !== 0) status = 'blocked';
                  else if (lastEntry.status === 'running') status = 'working';
                }
              }
            }
          } catch { /* skip */ }

          return {
            id,
            ...meta,
            status,
            lastActivity,
            currentWork,
          };
        });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(agents));
      });

      // ── Cross-repo issues ───────────────────────────────────
      const ISSUE_CACHE_TTL = 30_000;
      let issueCache = null;
      let issueCacheTime = 0;

      server.middlewares.use('/api/issues', (req, res) => {
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
      });

      // ── Studio pulse (aggregate stats) ─────────────────────
      server.middlewares.use('/api/pulse', (req, res) => {
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
            if (fs.existsSync(logsDir)) {
              const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.jsonl') && f.includes(today));
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
  base: '/ffs-squad-monitor/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    passWithNoTests: true,
  },
});
