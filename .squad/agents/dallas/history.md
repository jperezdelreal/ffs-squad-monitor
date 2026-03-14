# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Issue #50: Expand Zustand Store for Centralized State Management (2026-03-13)

**Architecture decisions:**
- Zustand store is now the single source of truth for: heartbeat, events, issues, usage, agents
- Store actions handle all API fetching (fetchHeartbeat, fetchEvents, fetchIssues, fetchUsage, fetchAgents)
- `refreshAll()` orchestrates fetches: parallel data fetches, then sequential agent derivation
- Agents are derived in the store from issues + config (via `fetchConfig` from config service)

**Key patterns:**
- Components call store fetch actions on mount (via useEffect) AND receive data via polling
- `usePolling` drives all data refresh by calling `store.refreshAll()` every 60s
- Local component state only for UI-specific concerns (filters, modals, selected items)
- Pipeline data derived via `useMemo` from store issues (no separate fetch)
- `initialState` exported for test reset between test cases

**Testing patterns:**
- Store state reset in test setup via `useStore.setState({ ...initialState })`
- URL-aware fetch mocks needed when store actions call multiple endpoints (e.g., TeamBoard uses /api/issues AND /api/config)
- `clearConfigCache()` between tests to prevent config service caching across tests
- `vi.mock` for config module doesn't reliably cross module boundaries to store — use URL-aware global.fetch mocks instead

**File paths:**
- `src/store/store.js` - Expanded Zustand store with all state + actions
- `src/hooks/usePolling.js` - Simplified to call store.refreshAll()
- `src/components/ActivityFeed.jsx` - Reads events from store
- `src/components/PipelineVisualizer.jsx` - Reads issues from store, derives pipeline via useMemo
- `src/components/TeamBoard.jsx` - Reads agents from store
- `src/components/CostTracker.jsx` - Reads usage from store

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

### Issues #52 & #53: Request Optimization & Health Check (2026-03-13)

**Architecture decisions:**
- `src/lib/request-cache.js` is a standalone factory (`createRequestCache`) — not coupled to api.js internals
- Cache integrated into api.js via `safeFetch` wrapping `rawFetch` through `dedupedFetch`
- Errors are never cached — only successful responses get TTL-based caching
- Backend `/api/health` uses cached GitHub reachability checks (60s interval) to avoid rate limit waste
- DependencyHealth component polls independently at 30s, separate from main polling cycle

**Key patterns:**
- In-flight dedup via pending promise Map — all concurrent callers get the same promise
- Cache key is the URL string (simple and effective for our GET-only API)
- `requestCache` exported from api.js so tests can `clear()` between test cases
- DependencyHealth tests mock `fetchHealth` via `vi.mock('../../lib/api')` to avoid cache interference
- Backend health route is async (awaits GitHub check) unlike other sync route handlers

**File paths:**
- `src/lib/request-cache.js` - Dedup + cache utility
- `src/lib/api.js` - Integrated cache, added fetchHealth()
- `server/api/health.js` - Backend health endpoint with dependency status
- `src/components/DependencyHealth.jsx` - Dashboard dependency health widget
- `src/components/Header.jsx` - Added DependencyHealth to header bar


### Issues #46/#47: Operational Intelligence - Bottleneck Detection and Blocked-Time Tracking (2026-03-14)

**Architecture decisions:**
- Pipeline bottleneck detection uses threshold-based analysis (5+ open issues in a stage)
- Bottleneck status coexists with existing pipeline statuses (pending/in-progress/complete/blocked)
- Agent blocked-time computed from blocked-by:* labels + updatedAt timestamps
- Three-tier severity model for blocked agents: <4h (yellow), >4h (orange), >24h (red)

**Key patterns:**
- calcAvgTimeInStage() computes average duration from createdAt timestamps of open issues
- getBlockedInfo() filters agent issues by blocked-by:* labels and sorts by longest block
- agentBlockedInfo useMemo depends on [agents, issues] - recomputes when either changes
- Blocked agents sorted to top of grid via .sort() before .map() rendering
- Used Unicode escapes for emoji in JSX to avoid encoding issues in test environments

**File paths:**
- src/components/PipelineVisualizer.jsx - Bottleneck detection, avg time, STUCK badge
- src/components/TeamBoard.jsx - Blocked-time tracking, severity indicators, sort-to-top

### Issue #112: Mobile Responsive Layout with Tailwind Breakpoints (2026-03-14)

**Architecture decisions:**
- Implemented progressive disclosure pattern: critical UI always visible, secondary info shows on larger screens
- Hamburger menu for sidebar on mobile (lg:hidden) with slide-in/slide-out animation
- All touch targets sized to minimum 44x44px (Apple/Android accessibility guidelines)
- Responsive breakpoints follow mobile-first approach: sm (640px), md (768px), lg (1024px), xl (1280px)

**Key responsive patterns:**
- Fixed positioning with transform transitions for mobile sidebar (`fixed lg:static`, `translate-x-full lg:translate-x-0`)
- Mobile overlay to close sidebar on tap outside (`fixed inset-0 bg-black/60 z-40 lg:hidden`)
- Conditional rendering by screen size: `hidden sm:block`, `hidden md:block`, `hidden lg:block`
- Flexible layouts: `flex-col sm:flex-row` for stacked-to-horizontal transitions
- Grid responsiveness: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Horizontal scroll for wide tables: `overflow-x-auto` with `min-w-[800px]` on table element
- Responsive spacing: `p-3 sm:p-4 md:p-6`, `space-y-3 sm:space-y-4 md:space-y-6`, `gap-2 sm:gap-3 md:gap-6`
- Responsive text: `text-xs sm:text-sm`, `text-lg sm:text-xl md:text-2xl`

**Mobile UX improvements:**
- Header hamburger button (3-line icon) with proper tap target
- Sidebar close button (X icon) visible only on mobile
- NotificationBell always visible (critical alerts)
- ConnectionStatus hidden on mobile (<640px), shown on sm+
- HealthBadge hidden on small/mobile (<768px), shown on md+
- DependencyHealth hidden on tablet (<1024px), shown on lg+
- Buttons stretched to full width on mobile, auto width on desktop
- Chart heights reduced on mobile: `h-48 sm:h-56 md:h-64`

**Component updates:**
- **App.jsx** - Added sidebarOpen state, handleViewChange closes sidebar, mobile overlay, responsive main padding
- **Header.jsx** - Hamburger button, onMenuClick prop, progressive disclosure of status widgets, responsive layout
- **Sidebar.jsx** - isOpen/onClose props, fixed-to-static positioning, close button, responsive padding/sizing
- **TeamBoard.jsx** - Responsive grid (1→2→3→4 cols), flex-col→row header, responsive card sizing
- **ActivityFeed.jsx** - Stacked filters on mobile, flex-col→row layout, responsive selects
- **PipelineVisualizer.jsx** - Horizontal scroll table, responsive headers, condensed mobile view
- **Analytics.jsx** - Responsive KPI grid, chart heights, button sizing
- **TrendCharts.jsx** - Responsive time range selector, chart container sizing
- **CostTracker.jsx** - Responsive typography and spacing
- **TimelineSwimlane.jsx** - Responsive controls, zoom button tap targets

**File paths:**
- `src/App.jsx` - Mobile sidebar state and overlay
- `src/components/Header.jsx` - Hamburger menu and progressive disclosure
- `src/components/Sidebar.jsx` - Collapsible navigation
- `src/components/TeamBoard.jsx` - Responsive agent grid
- `src/components/ActivityFeed.jsx` - Responsive filters
- `src/components/PipelineVisualizer.jsx` - Scrollable pipeline table
- `src/components/Analytics.jsx` - Responsive analytics dashboard
- `src/components/TrendCharts.jsx` - Responsive trend charts
- `src/components/CostTracker.jsx` - Responsive cost display
- `src/components/TimelineSwimlane.jsx` - Responsive timeline controls
