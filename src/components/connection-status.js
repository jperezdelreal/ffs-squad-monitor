/**
 * Connection status indicator component.
 * Shows a colored dot + label in the top bar reflecting API connectivity.
 */
import { onConnectionChange, isConnected } from '../lib/api.js';

export function initConnectionStatus() {
  const dot = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');

  function render(ok) {
    dot.className = ok ? 'dot green' : 'dot red';
    text.textContent = ok ? 'Connected' : 'Disconnected';
  }

  // Set initial state
  render(isConnected());
  onConnectionChange(render);
}
