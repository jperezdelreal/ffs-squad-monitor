/**
 * FFS Squad Monitor — Dashboard entry point.
 *
 * Sci-fi mission control for First Frame Studios.
 * Component-based architecture with configurable polling.
 */

import { Scheduler } from './lib/scheduler.js';
import { initConnectionStatus } from './components/connection-status.js';
import { refreshHeartbeat } from './components/heartbeat.js';
import { refreshLogs, initLogViewer, focusLogSearch } from './components/log-viewer.js';
import { refreshTimeline, initTimeline } from './components/timeline.js';
import { refreshAgents } from './components/agent-activity.js';
import { refreshBoard } from './components/cross-repo-board.js';
import { refreshPulse } from './components/studio-pulse.js';
import { initSettings, openSettings } from './components/settings.js';

// Polling intervals (ms)
const HEARTBEAT_POLL = 5000;
const LOG_POLL       = 10000;
const AGENTS_POLL    = 10000;
const TIMELINE_POLL  = 10000;
const BOARD_POLL     = 30000;
const PULSE_POLL     = 30000;

// Bootstrap
const scheduler = new Scheduler();

scheduler.register('heartbeat', refreshHeartbeat, HEARTBEAT_POLL);
scheduler.register('logs',      refreshLogs,      LOG_POLL);
scheduler.register('agents',    refreshAgents,     AGENTS_POLL);
scheduler.register('timeline',  refreshTimeline,   TIMELINE_POLL);
scheduler.register('board',     refreshBoard,      BOARD_POLL);
scheduler.register('pulse',     refreshPulse,      PULSE_POLL);

// Init components that need DOM event binding
initConnectionStatus();
initLogViewer();
initTimeline();
initSettings(scheduler);
initKeyboardShortcuts(scheduler);

// Start polling
showLoading();
scheduler.startAll();

// Hide loading after initial data loads
setTimeout(() => hideLoading(), 2000);

console.log('[FFS Monitor] Dashboard online — mission control active');

// ── Keyboard Shortcuts ───────────────────────────────────

function initKeyboardShortcuts(scheduler) {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea
    if (e.target.matches('input, textarea, select')) return;

    switch (e.key.toLowerCase()) {
      case 'r':
        e.preventDefault();
        refreshAll(scheduler);
        break;
      case 's':
        e.preventDefault();
        openSettings();
        break;
      case 'l':
        e.preventDefault();
        focusLogSearch();
        break;
      case '?':
        e.preventDefault();
        showShortcutsModal();
        break;
      case 'escape':
        hideShortcutsModal();
        break;
    }
  });

  // Modal close button
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideShortcutsModal);
  }

  // Close modal on backdrop click
  const modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideShortcutsModal();
    });
  }
}

function refreshAll(scheduler) {
  showLoading('Refreshing...');
  scheduler.refreshAll();
  setTimeout(() => hideLoading(), 1500);
}

function showShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) modal.style.display = 'flex';
}

function hideShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) modal.style.display = 'none';
}

// ── Loading States ───────────────────────────────────────

let loadingTimeout = null;

function showLoading(text = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const textEl = overlay?.querySelector('.loading-text');
  if (textEl) textEl.textContent = text;
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  if (loadingTimeout) clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }, 300);
}
