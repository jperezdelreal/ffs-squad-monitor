import fs from 'fs';
import path from 'path';
import { config, SQUAD_AGENTS } from '../config.js';

// Parse orchestration-log files: "2026-03-11T15-33-03Z-solo.md" → { agent: "solo", timestamp: "2026-03-11T15:33:03Z" }
function getOrchestrationActivity() {
  const activity = new Map();
  try {
    if (!fs.existsSync(config.orchestrationLogDir)) return activity;
    const files = fs.readdirSync(config.orchestrationLogDir)
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
        const content = fs.readFileSync(path.join(config.orchestrationLogDir, file), 'utf-8');
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

/**
 * @openapi
 * /api/agents:
 *   get:
 *     summary: Get squad agent statuses
 *     description: Returns all squad agents with their current status (idle, working, blocked), last activity timestamp, and current work description. Sources data from orchestration logs and JSONL logs.
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: Array of agent status objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agent'
 */
export default function workflowsRoute(req, res) {
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
    const logFile = path.join(config.logsDir, `${id}-${today}.jsonl`);
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
}
