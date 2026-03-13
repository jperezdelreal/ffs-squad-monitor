# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Issue #23: Error Handling and Offline Resilience (2026-03-12)

**Architecture decisions:**
- Implemented 3-state connection tracking (operational/degraded/offline) in api.js
- Created centralized error boundary in error-boundary.js for component crash protection
- SSE reconnection uses exponential backoff pattern (1s, 2s, 4s, 8s, max 30s)
- Each component has its own error state UI with retry functionality

**Key patterns:**
- API layer returns `{ error: true, message }` instead of `null` for better error context
- Components check `data?.error` and call dedicated `renderXError()` functions
- Global retry functions exposed via `window.__retryX()` for onclick handlers
- Error notifications auto-dismiss after 5s, critical overlay on 10+ errors

**File paths:**
- `src/lib/api.js` - Connection state tracking and error logging
- `src/lib/error-boundary.js` - Global error handler
- `src/components/*.js` - All components have error states
- `src/styles.css` - Added `.error-state`, `.retry-btn`, notification styles

### PR #27 Review Fixes (2026-03-13)

**Code review learnings:**
- Error count reset mechanism prevents permanent dashboard lockup after transient errors
- Explicit AbortController with cleanup in both success/error paths prevents memory leaks
- Exponential backoff must calculate delay BEFORE incrementing attempt counter for correct timing
- All components need consistent error UI patterns (error icon + message + retry button)

**Security improvements:**
- Always use `textContent` instead of `innerHTML` for user-controlled error messages (XSS prevention)
- Add `event.preventDefault()` on unhandledrejection to suppress console warnings while handling

**Memory management patterns:**
- Use explicit AbortController + setTimeout instead of AbortSignal.timeout() for better GC
- Always clear timeouts in both success and error paths
- Clean up event sources and timers on reconnection attempts
