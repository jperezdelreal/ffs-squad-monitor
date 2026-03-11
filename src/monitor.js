/**
 * FFS Squad Monitor — Dashboard entry point.
 *
 * Component-based architecture:
 *   - Each UI section is an independent module in src/components/
 *   - Polling managed by a configurable Scheduler
 *   - API layer handles connectivity tracking
 */

import { Scheduler } from './lib/scheduler.js';
import { initConnectionStatus } from './components/connection-status.js';
import { refreshHeartbeat } from './components/heartbeat.js';
import { refreshLogs, initLogViewer } from './components/log-viewer.js';
import { refreshRepos } from './components/repos.js';
import { refreshTimeline, initTimeline } from './components/timeline.js';
import { initSettings } from './components/settings.js';

// Default polling intervals (ms)
const HEARTBEAT_POLL = 5000;
const LOG_POLL       = 10000;
const REPOS_POLL     = 30000;
const TIMELINE_POLL  = 10000;

// Bootstrap
const scheduler = new Scheduler();

scheduler.register('heartbeat', refreshHeartbeat, HEARTBEAT_POLL);
scheduler.register('logs',      refreshLogs,      LOG_POLL);
scheduler.register('repos',     refreshRepos,     REPOS_POLL);
scheduler.register('timeline',  refreshTimeline,  TIMELINE_POLL);

// Init components that need DOM event binding
initConnectionStatus();
initLogViewer();
initTimeline();
initSettings(scheduler);

// Start polling
scheduler.startAll();

console.log('[FFS Monitor] Dashboard online');
