/**
 * Global error boundary for handling uncaught component errors.
 * Logs errors and displays a fallback UI to prevent complete dashboard crash.
 */

let errorCount = 0;
const MAX_ERRORS_BEFORE_STOP = 10;

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
  errorCount++;
  
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
  notification.innerHTML = `
    <div class="error-notification-content">
      <span class="error-notification-icon">⚠️</span>
      <span class="error-notification-text">
        ${component} error: ${error?.message || 'Unknown error'}
      </span>
      <button class="error-notification-close" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
  `;
  
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
