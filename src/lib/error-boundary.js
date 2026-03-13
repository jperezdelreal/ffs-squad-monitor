/**
 * Global error boundary for handling uncaught component errors.
 * Logs errors and displays a fallback UI to prevent complete dashboard crash.
 */

let errorCount = 0;
let lastErrorTime = 0;
const MAX_ERRORS_BEFORE_STOP = 10;
const ERROR_COUNT_RESET_WINDOW = 60000; // 1 minute

export function initErrorBoundary() {
  // Global error handler for uncaught errors
  window.addEventListener('error', (event) => {
    handleComponentError('Global', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    handleComponentError('Promise', event.reason, {
      promise: event.promise,
    });
  });
}

export function wrapComponentRefresh(componentName, refreshFn) {
  return async function wrappedRefresh() {
    try {
      await refreshFn();
    } catch (error) {
      handleComponentError(componentName, error);
    }
  };
}

function handleComponentError(component, error, context = {}) {
  const now = Date.now();
  
  // Reset error count if it's been >1 minute since last error
  if (now - lastErrorTime > ERROR_COUNT_RESET_WINDOW) {
    errorCount = 0;
  }
  
  errorCount++;
  lastErrorTime = now;
  
  console.error(`[Error Boundary] ${component} error:`, {
    component,
    message: error?.message || String(error),
    stack: error?.stack,
    context,
    timestamp: new Date().toISOString(),
    errorCount,
  });

  // If too many errors, show critical error overlay
  if (errorCount >= MAX_ERRORS_BEFORE_STOP) {
    showCriticalErrorOverlay();
    return;
  }

  // Show error notification
  showErrorNotification(component, error);
}

function showErrorNotification(component, error) {
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  
  const content = document.createElement('div');
  content.className = 'error-notification-content';
  
  const icon = document.createElement('span');
  icon.className = 'error-notification-icon';
  icon.textContent = '⚠️';
  
  const text = document.createElement('span');
  text.className = 'error-notification-text';
  text.textContent = `${component} error: ${error?.message || 'Unknown error'}`;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'error-notification-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => notification.remove();
  
  content.appendChild(icon);
  content.appendChild(text);
  content.appendChild(closeBtn);
  notification.appendChild(content);
  
  document.body.appendChild(notification);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function showCriticalErrorOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'critical-error-overlay';
  overlay.innerHTML = `
    <div class="critical-error-content">
      <div class="critical-error-icon">⚠️</div>
      <h2>Dashboard Error</h2>
      <p>Multiple errors detected. The dashboard may be unstable.</p>
      <button class="critical-error-reload" onclick="location.reload()">Reload Dashboard</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
}
