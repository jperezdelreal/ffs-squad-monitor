import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

// Cached heartbeat state — updated via fs.watch
let heartbeatCache = null;
let heartbeatWatcher = null;

function readHeartbeatFile() {
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

export default function heartbeatRoute(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(getHeartbeatResponse()));
}
