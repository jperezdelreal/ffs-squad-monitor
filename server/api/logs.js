import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export function listLogFiles() {
  try {
    if (!fs.existsSync(config.logsDir)) return [];
    return fs.readdirSync(config.logsDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const match = f.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.jsonl$/);
        return match ? { file: f, agent: match[1], date: match[2] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

export function parseLogEntry(line, agent) {
  try {
    const entry = JSON.parse(line);
    entry._agent = agent;
    entry._level = entry.exitCode === 0 ? 'info' : 'error';
    if (entry.consecutiveFailures > 0 && entry.exitCode === 0) entry._level = 'warn';
    return entry;
  } catch { return null; }
}

export function readLogEntries(agent, date) {
  const filename = `${agent}-${date}.jsonl`;
  const filePath = path.join(config.logsDir, filename);
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    if (!raw.trim()) return [];
    return raw.trim().split('\n')
      .map(line => parseLogEntry(line, agent))
      .filter(Boolean);
  } catch { return []; }
}

/**
 * @openapi
 * /api/logs/files:
 *   get:
 *     summary: List available log files
 *     description: Returns lists of available agents, dates, and log files for use in date/agent pickers.
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: Available log files metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [ralph, solo, moe]
 *                 dates:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: date
 *                   example: ['2026-03-13', '2026-03-12']
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       file:
 *                         type: string
 *                         example: ralph-2026-03-13.jsonl
 *                       agent:
 *                         type: string
 *                         example: ralph
 *                       date:
 *                         type: string
 *                         format: date
 *                         example: '2026-03-13'
 */
// List available log files (for date/agent pickers)
export function logsFilesRoute(req, res) {
  const files = listLogFiles();
  const agents = [...new Set(files.map(f => f.agent))];
  const dates = [...new Set(files.map(f => f.date))];
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ agents, dates, files }));
}

/**
 * @openapi
 * /api/logs/stream:
 *   get:
 *     summary: Stream log entries in real-time
 *     description: |
 *       SSE endpoint that streams new log entries as they are written. Watches the logs directory for file changes.
 *       Sends all existing entries on connect, then new entries as they appear. Keepalive every 15 seconds.
 *     tags: [Logs]
 *     parameters:
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Only stream entries newer than this timestamp
 *     responses:
 *       200:
 *         description: SSE stream of log entries
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Each data event contains a JSON LogEntry object
 */
// SSE endpoint — streams new log entries in real time
export function logsStreamRoute(req, res) {
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
      if (!fs.existsSync(config.logsDir)) return;
      const files = fs.readdirSync(config.logsDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(config.logsDir, file);
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
    if (fs.existsSync(config.logsDir)) {
      watcher = fs.watch(config.logsDir, { persistent: false }, () => debouncedScan());
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
}

/**
 * @openapi
 * /api/logs:
 *   get:
 *     summary: Get structured log entries
 *     description: Returns parsed JSONL log entries for a given date and optional agent filter. Falls back to latest available date if no logs exist for today.
 *     tags: [Logs]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: '2026-03-13'
 *         description: Date in YYYY-MM-DD format. Defaults to today.
 *       - in: query
 *         name: agent
 *         schema:
 *           type: string
 *           example: ralph
 *         description: Filter by agent name
 *     responses:
 *       200:
 *         description: Array of log entries sorted by timestamp
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LogEntry'
 *       500:
 *         description: Failed to read logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Structured logs — supports ?date=YYYY-MM-DD&agent=name query params
export default function logsRoute(req, res) {
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
}
