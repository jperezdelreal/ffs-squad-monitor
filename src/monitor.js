/**
 * FFS Squad Monitor — Dashboard entry point.
 *
 * Sci-fi mission control for First Frame Studios.
 * Component-based architecture with configurable polling.
 */

import { Scheduler } from './lib/scheduler.js';
import { initErrorBoundary, wrapComponentRefresh } from './lib/error-boundary.js';
import { initConnectionStatus } from './components/connection-status.js';
import { refreshHeartbeat } from './components/heartbeat.js';
import { refreshLogs, initLogViewer } from './components/log-viewer.js';
import { refreshTimeline, initTimeline } from './components/timeline.js';
import { refreshAgents } from './components/agent-activity.js';
import { refreshBoard } from './components/cross-repo-board.js';
import { refreshPulse } from './components/studio-pulse.js';
import { initSettings } from './components/settings.js';

// Polling intervals (ms)
const HEARTBEAT_POLL = 5000;
const LOG_POLL       = 10000;
const AGENTS_POLL    = 10000;
const TIMELINE_POLL  = 10000;
const BOARD_POLL     = 30000;
const PULSE_POLL     = 30000;

// Initialize error boundary first
initErrorBoundary();

// Bootstrap
const scheduler = new Scheduler();

// Wrap all refresh functions with error boundary
scheduler.register('heartbeat', wrapComponentRefresh('Heartbeat', refreshHeartbeat), HEARTBEAT_POLL);
scheduler.register('logs',      wrapComponentRefresh('Logs', refreshLogs),           LOG_POLL);
scheduler.register('agents',    wrapComponentRefresh('Agents', refreshAgents),       AGENTS_POLL);
scheduler.register('timeline',  wrapComponentRefresh('Timeline', refreshTimeline),   TIMELINE_POLL);
scheduler.register('board',     wrapComponentRefresh('Board', refreshBoard),         BOARD_POLL);
scheduler.register('pulse',     wrapComponentRefresh('Pulse', refreshPulse),         PULSE_POLL);

// Init components that need DOM event binding
initConnectionStatus();
initLogViewer();
initTimeline();
initSettings(scheduler);

// Start polling
scheduler.startAll();

console.log('[FFS Monitor] Dashboard online — mission control active');
