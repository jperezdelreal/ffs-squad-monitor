# Project Context

- **Owner:** joperezd
- **Project:** ffs-squad-monitor — Real-time monitoring dashboard for First Frame Studios' AI squad operations
- **Stack:** Vanilla JS, Vite, CSS, component-based architecture, custom polling scheduler
- **Created:** 2026-03-12

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Issue #138 / PR #163: Integration Test Alignment (2026-03-15)

**Test Architecture Alignment:**
- Component tests must mock Zustand store state, not global.fetch - components read from `useStore` selectors
- Store state reset in beforeEach: `useStore.setState({ events: [], eventsLoading: false, eventsError: null, fetchEvents: vi.fn() })`
- Tests verify component behavior based on store state, not API responses
- Error messages rendered directly from store error strings (not hardcoded generic messages)
- Button labels must match actual component JSX ("Retry" not "Try Again", "Refresh" not "Reload")

**Code Quality Issues Found:**
- TrendCharts.jsx had duplicate BarChart components (lines 159+160, 167+168) - removed non-existent variable references (agentsSeries, labelsSeries)
- Tests referenced non-existent hooks/stores that Kane assumed existed but don't (useSessionStore, useMetricsStore don't exist - we use single `useStore` from Zustand)
- Loading state tests must query DOM structure (skeleton with `animate-pulse` class) not text content

**Testing Patterns for Store-Based Components:**
```javascript
// Mock store state
useStore.setState({
  events: mockData,
  eventsLoading: false,
  eventsError: null,
  fetchEvents: vi.fn(),
})

// Test loading state
useStore.setState({ eventsLoading: true, events: [] })
const { container } = render(<Component />)
expect(container.querySelector('[class*="animate-pulse"]')).toBeInTheDocument()

// Test error state - check actual error text from store
useStore.setState({ eventsError: 'Network error' })
expect(screen.getByText(/Network error/)).toBeInTheDocument()
```

**Reviewer Lockout Policy Application:**
- When PR author (Kane) is locked out after changes requested, another agent (Dallas) takes over revision
- New agent must understand ACTUAL codebase architecture before fixing tests (don't assume structure)
- Fix tests to match reality, don't rewrite tests from scratch - preserve test intent

**File paths:**
- src/components/TrendCharts.jsx - Fixed duplicate components
- src/components/__tests__/TrendCharts.test.jsx - 4/5 passing (store-based mocking)
- src/components/__tests__/ActivityFeed.test.jsx - 11/12 passing (store-based mocking)

**Remaining work:**
- ~55 more test failures across integration tests (SSE, EventBus) and other component tests
- Integration tests need proper SSE/EventBus mocking patterns
- Backend tests need lifecycle cleanup (timer/connection cleanup in afterEach)

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
- Hamburger menu pattern for sidebar on mobile (<lg breakpoint)
- Mobile-first responsive utilities using Tailwind breakpoints (sm:, md:, lg:)
- Touch-friendly minimum tap targets (44x44px) on all interactive elements
- Responsive padding/spacing scales down on smaller screens (p-3 sm:p-4 md:p-6)
- Collapsible sidebar slides in/out with overlay on mobile, static on desktop
- Header elements hide progressively (lg: health badge, md: dependency health, sm: connection status)

**Key patterns:**
- App.jsx manages mobileMenuOpen state and passes to Sidebar and Header
- Sidebar uses fixed positioning with translate-x transforms for slide animation
- Mobile overlay (bg-black/50) dismisses menu on click outside
- Flex layouts switch from row to column on mobile (flex-col sm:flex-row)
- Chart heights reduce on mobile (h-48 sm:h-64) for better viewport usage
- Pipeline table uses sticky column headers with responsive cell padding
- Button text and icons scale down on mobile with hidden labels where appropriate

**File paths:**
- src/App.jsx - Mobile menu state management, responsive padding on main
- src/components/Sidebar.jsx - Collapsible sidebar with hamburger close button
- src/components/Header.jsx - Hamburger menu button, progressive element hiding
- src/components/ActivityFeed.jsx - Responsive filter bar, touch-friendly controls
- src/components/PipelineVisualizer.jsx - Responsive table cells and legend
- src/components/TrendCharts.jsx - Responsive chart heights and button wrapping
- src/components/TimelineSwimlane.jsx - Responsive controls with hidden zoom on mobile

**Testing:**
- All 544 tests pass after responsive changes
- No new test additions required (visual/layout changes only)
- Responsive behavior verified manually at sm/md/lg breakpoints

### Issue #144: Loading States Overhaul — Skeleton Screens with Shimmer Animation (2026-03-14)

**Architecture decisions:**
- Created reusable Skeleton component library in `src/components/Skeleton.jsx`
- Shimmer effect uses CSS gradient with `animate-shimmer` keyframe (200% background position sweep)
- All skeleton components use `aria-hidden="true"` for accessibility
- Content-aware skeletons match the exact shape and layout of final content
- Smooth fade-in transition (`animate-fade-in`) when real data replaces skeleton

**Component primitives:**
- `Skeleton` - Base with shimmer/pulse animation, variant support (default/text/card/circle/button)
- `SkeletonText` - Text line placeholders with auto-width on last line
- `SkeletonCard` - Glass card container with default content or custom children
- `SkeletonFeedItem` - Avatar + two text lines for ActivityFeed
- `SkeletonList` - Repeating list of skeleton items (default 5)
- `SkeletonChart` - Chart placeholder with title + large content area
- `SkeletonAgentCard` - Agent avatar + name + status for TeamBoard
- `SkeletonGrid` - Responsive grid (1/2/3/4/6/8 cols) with custom item component
- `SkeletonTimelineBar` - Timeline swimlane bar with avatar + bar
- `SkeletonTableRow` - Table row with configurable column count
- `SkeletonStatCard` - Stat card with title + value + description
- `SkeletonContainer` - Wrapper with glass effect and spacing

**Shimmer animation:**
- Added `animate-shimmer` keyframe to Tailwind config
- Gradient background: `from-white/5 via-white/10 to-white/5`
- Background size: `200%` horizontal
- Animation: 2s infinite ease-in-out sweep from -200% to +200%
- Fallback: `animate-pulse` when shimmer disabled

**Components updated:**
- ActivityFeed - SkeletonContainer + SkeletonList (5 feed items)
- TeamBoard - SkeletonGrid (4×2 agent cards)
- PipelineVisualizer - SkeletonGrid (7×6 cells)
- CostTracker - SkeletonStatCard grid (2×2)
- Analytics - SkeletonChart ×4
- TrendCharts - SkeletonChart ×3
- TimelineSwimlane - SkeletonTimelineBar ×3
- DependencyHealth - Already has minimal pulsing dot (kept as-is)

**Key patterns:**
- Import skeleton primitives at component level: `import { SkeletonX } from './Skeleton'`
- Replace loading div blocks with semantic skeleton components
- Skeletons render during `loading && !data.length` state
- Real content uses `animate-fade-in` for smooth transition
- Zero spinners or "Loading..." text remaining in UI

**Testing:**
- Created comprehensive test suite: `Skeleton.test.jsx` with 25 tests
- 100% coverage of all skeleton primitives
- Tests verify shimmer animation, variants, custom classes, and layout
- All existing component tests pass (570 total)
- Build succeeds with no bundle size issues

**File paths:**
- `src/components/Skeleton.jsx` - Skeleton component library (new)
- `src/components/__tests__/Skeleton.test.jsx` - Test suite (new)
- `tailwind.config.js` - Added shimmer keyframe animation
- `src/components/ActivityFeed.jsx` - Updated loading state
- `src/components/TeamBoard.jsx` - Updated loading state
- `src/components/PipelineVisualizer.jsx` - Updated loading state
- `src/components/CostTracker.jsx` - Updated loading state
- `src/components/Analytics.jsx` - Updated loading state
- `src/components/TrendCharts.jsx` - Updated loading state
- `src/components/TimelineSwimlane.jsx` - Updated loading state

### Issue #142: Mobile Responsive Polish — Native App Feel (2026-03-14)

**Architecture decisions:**
- Bottom navigation bar visible only on mobile (<md breakpoint) as alternative to sidebar
- Swipe gesture detection via custom `useSwipeGesture` hook (threshold-based horizontal swipe)
- Touch event handlers (onTouchStart/Move/End) added to TimelineSwimlane for mobile drag
- Scroll snap CSS utilities for smooth section-to-section scrolling on mobile
- Safe area CSS utilities using `env(safe-area-inset-*)` for notched devices
- Portrait-optimized chart heights: h-56 (mobile) → h-64 (sm) → h-72 (md)

**Key patterns:**
- MobileBottomNav component shows 4 primary views (Activity, Pipeline, Team, Charts)
- Swipe gesture: right=open sidebar, left=close sidebar (threshold: 75px horizontal delta)
- Touch drag on timeline uses same state/logic as mouse drag, just different event handlers
- Main content area has `pb-20 md:pb-6` to accommodate bottom nav on mobile
- Scroll container has `scroll-smooth snap-y snap-proximity` for native feel
- Major card sections use `snap-start` class for scroll anchoring
- Viewport meta includes `viewport-fit=cover` for full-screen notch support

**Mobile optimizations:**
- Bottom nav uses `safe-area-bottom` padding for devices with gesture bars
- Touch-pan-x/y classes enable single-axis touch scrolling
- Timeline drag preserves momentum feel with 1.5x multiplier
- Charts increase height on larger screens (better data visibility)
- All interactive elements maintain 44px minimum touch target size

**File paths:**
- `src/components/MobileBottomNav.jsx` - Mobile bottom navigation bar (new)
- `src/hooks/useSwipeGesture.js` - Swipe gesture detection hook (new)
- `src/App.jsx` - Integrated swipe gestures and bottom nav
- `src/components/TimelineSwimlane.jsx` - Added touch event handlers
- `src/components/TrendCharts.jsx` - Portrait-optimized chart heights
- `src/components/ActivityFeed.jsx` - Added snap-start
- `src/components/PipelineVisualizer.jsx` - Added snap-start, touch-pan-x
- `src/components/TeamBoard.jsx` - Added snap-start
- `src/index.css` - Safe area and scroll snap CSS utilities
- `index.html` - Enhanced viewport meta tags

**Testing:**
- Build succeeds with no errors
- 599 tests passing (no new test failures)
- Manual testing recommended on mobile device or Chrome DevTools emulator

### Issue #138 / PR #163: Integration Test Fixes Round 2 (2026-03-15)

**Test Architecture Fixes:**
- SSE mock EventSource must call both `onerror` handler AND `addEventListener('error')` handlers
- SSE event data must wrap in eventBus format: `{ id, type, channel, data, timestamp }`
- Store needs snapshot event handlers for all channels (heartbeat:snapshot, issues:snapshot, usage:snapshot)
- Store needs incremental update handlers (issues:new for additions, issues:update for single-issue updates)
- EventBus debouncing: first event on a channel emits immediately, subsequent within 1s are coalesced
- Zustand store spy setup: create spy BEFORE rendering hook (spy must exist in closure)

**Event Coalescing Behavior:**
- First publish on a channel: elapsed >= 1000ms (no previous event), emits immediately
- Subsequent publishes within 1s: queued and coalesced, emit after debounce window
- Tests must expect 2 emissions per rapid burst: immediate + coalesced (not just 1)
- Each channel has independent debounce state (per-channel coalescing)

**Metrics Aggregation Fixes:**
- SQL hourly rollup: use `baseDate.setMinutes(0,0,0)` to ensure timestamps stay within hour boundary
- Retention policy tests: insert records spanning >30 days to actually test deletion logic
- SQLite date arithmetic: `timestamp < cutoff` won't delete records at exact cutoff timestamp

**Progress:**
- Reduced test failures from 52 → 21 (60% reduction)
- Integration tests: 47/50 passing (3 remaining failures)
- Store handlers now support SSE snapshot and incremental update patterns

**File paths:**
- `src/__tests__/integration/state-machine.test.js` - Fixed onerror mock
- `src/__tests__/integration/sse-reconnection.test.js` - Fixed onerror mock, spy timing
- `src/__tests__/integration/cross-feature-pipeline.test.js` - Fixed onerror mock, data format
- `src/__tests__/integration/event-coalescing.test.js` - Corrected debounce expectations
- `src/__tests__/integration/metrics-aggregation.test.js` - Fixed hourly rollup, retention tests
- `src/store/store.js` - Added snapshot handlers, issues:new handler, incremental update logic


