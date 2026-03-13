import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';

// Cached heartbeat state — updated via fs.watch
let heartbeatCache = null;
let heartbeatWatcher = null;

function readHeartbeatFile() {
  const prevCache = heartbeatCache;
  try {
    const raw = fs.readFileSync(config.heartbeatPath, 'utf-8').replace(/^\uFEFF/, '');
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

  // Publish to event bus when heartbeat data changes
  if (heartbeatCache && JSON.stringify(heartbeatCache) !== JSON.stringify(prevCache)) {
    eventBus.publish('heartbeat', 'heartbeat:update', heartbeatCache);
  }
}

function startWatcher() {
  if (heartbeatWatcher) return;
  const dir = path.dirname(config.heartbeatPath);
  const basename = path.basename(config.heartbeatPath);
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

export function getHeartbeatResponse() {
  // If watcher isn't active, try a fresh read
  if (!heartbeatWatcher) readHeartbeatFile();
  if (!heartbeatCache) {
    return { status: 'offline' };
  }
  return heartbeatCache;
}

// Initialize on module load
readHeartbeatFile();
startWatcher();

/**
 * @openapi
 * /api/heartbeat:
 *   get:
 *     summary: Get current heartbeat status
 *     description: Returns the latest Ralph scheduler heartbeat data, read from the `.ralph-heartbeat.json` file. Updated in real-time via file watcher.
 *     tags: [Heartbeat]
 *     responses:
 *       200:
 *         description: Current heartbeat data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Heartbeat'
 */
export default function heartbeatRoute(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(getHeartbeatResponse()));
}
