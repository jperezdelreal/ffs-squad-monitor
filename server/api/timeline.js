import { listLogFiles, readLogEntries } from './logs.js';
import { getHeartbeatResponse } from './heartbeat.js';

/**
 * @openapi
 * /api/timeline:
 *   get:
 *     summary: Get daily round timeline
 *     description: Returns structured log rounds for a given date, plus summary statistics and current heartbeat state. Falls back to latest available date if no logs exist for today.
 *     tags: [Timeline]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: '2026-03-13'
 *         description: Date in YYYY-MM-DD format. Defaults to today.
 *     responses:
 *       200:
 *         description: Timeline data for the requested date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timeline'
 *       500:
 *         description: Failed to build timeline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default function timelineRoute(req, res) {
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
}
