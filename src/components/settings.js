/**
 * Settings panel component.
 * Allows configuring auto-refresh intervals and pause/resume polling.
 */

const PRESETS = [
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
];

/** @param {import('../lib/scheduler.js').Scheduler} scheduler */
export function initSettings(scheduler) {
  const btn = document.getElementById('settings-toggle');
  const panel = document.getElementById('settings-panel');
  const refreshSelect = document.getElementById('refresh-interval');
  const pauseBtn = document.getElementById('pause-btn');

  if (!btn || !panel) return;

  // Populate refresh presets
  if (refreshSelect) {
    refreshSelect.innerHTML = PRESETS.map(p =>
      `<option value="${p.value}" ${p.value === scheduler.getInterval('heartbeat') ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    refreshSelect.addEventListener('change', () => {
      const val = parseInt(refreshSelect.value, 10);
      scheduler.setInterval('heartbeat', val);
      scheduler.setInterval('logs', val * 2);
      scheduler.setInterval('agents', val * 2);
      scheduler.setInterval('timeline', val * 2);
      scheduler.setInterval('board', val * 6);
      scheduler.setInterval('pulse', val * 6);
    });
  }

  // Toggle panel
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', panel.classList.contains('open'));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Pause/Resume
  let paused = false;
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      if (paused) {
        scheduler.pause();
        pauseBtn.textContent = '▶ Resume';
        pauseBtn.classList.add('paused');
      } else {
        scheduler.resume();
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.classList.remove('paused');
      }
    });
  }
}
