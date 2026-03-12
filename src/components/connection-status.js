/**
 * Connection status indicator component.
 * Shows a colored dot + label in the top bar reflecting API connectivity.
 * States: operational (green), degraded (yellow), offline (red)
 */
import { onConnectionChange, getConnectionState } from '../lib/api.js';

const stateConfig = {
  operational: { dot: 'dot green', text: '✓ All systems operational' },
  degraded: { dot: 'dot yellow', text: '⚠ Degraded' },
  offline: { dot: 'dot red', text: '✗ Offline' },
  unknown: { dot: 'dot gray', text: 'Connecting…' },
};

export function initConnectionStatus() {
  const dot = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');

  function render(state) {
    const config = stateConfig[state] || stateConfig.unknown;
    dot.className = config.dot;
    text.textContent = config.text;
  }

  // Set initial state
  render(getConnectionState());
  onConnectionChange(render);
}
