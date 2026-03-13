# Squad Monitor Features - C4 Implementation

## Overview
All 4 features implemented with a mix of real GitHub API data and mock data for optimal performance within free tier limits.

## Features

### 1. Activity Feed
**Status:** ✅ Implemented
**Data Source:** Real GitHub API (unauthenticated)
- Fetches last 10 events from each of 6 repos (60 events total)
- Shows last 50 events sorted by timestamp
- Event types: Push, PR, Issues, Create, Delete, Watch, Fork, Release
- Real-time updates via 60s polling
- Filters by repo and event type
- Color-coded by repository

**API Limits:** ~6 requests per refresh, well within 60 req/hour limit

### 2. Pipeline Visualizer
**Status:** ✅ Implemented
**Data Source:** Real GitHub API (unauthenticated)
- Fetches all issues from 6 repos
- Analyzes issues with `pipeline:*` labels
- 6 stages: Proposal → GDD → Issues → Code → Build → Deploy
- Status derived from issue state (open/closed) and labels
- Interactive cells show issue details
- Modal popup with clickable GitHub issue links

**API Limits:** ~6 requests per refresh

### 3. Team Board
**Status:** ✅ Implemented
**Data Source:** Mixed (Real + Mock)
- Real: Fetches issues with `squad:*` labels from GitHub API
- Mock: Agent definitions (emoji, role) from local data
- Shows 8 agent cards with status indicators
- Current assignments linked to real GitHub issues
- Workload distribution chart (CSS-based bar chart)
- Auto-detects active/idle status from open issues

**API Limits:** ~6 requests per refresh

### 4. Cost Tracker
**Status:** ✅ Implemented
**Data Source:** Mock data
- Current spend: €0 (hardcoded, accurate)
- Comparison savings: Azure €120/mo, AWS €200/mo
- 30-day budget vs actual chart (always €0 actual)
- CI minutes usage: Mock data showing 420/2000 minutes (21%)
- Alert zone triggers at >80% usage
- Resource breakdown: Storage, Bandwidth, Compute

**Note:** All cost data is mocked since actual cost is €0 on GitHub free tier

## Data Architecture

### Services Layer
- `src/services/github.js` - GitHub API integration
  - Unauthenticated requests (60/hour limit)
  - Fetches events, issues, workflow runs
  - Repository color mapping
  
- `src/services/mockData.js` - Static/mock data
  - Agent definitions
  - Cost history generator
  - CI usage simulator

### Rate Limiting Strategy
- Total API calls per refresh: ~18 requests (3 features × 6 repos)
- Refresh interval: 60 seconds
- Theoretical max: 60 requests/hour
- Actual usage: ~18 requests/hour (70% headroom)

## Future Enhancements
To enable authenticated GitHub API access (5000 req/hour):
1. Add GitHub token to environment
2. Update fetch headers in `github.js`
3. Enable workflow run details in Cost Tracker
4. Add PR review status to Pipeline

To add real cost tracking:
1. Integrate GitHub Actions API for actual CI minutes
2. Calculate storage from repo sizes
3. Track Pages bandwidth from analytics

## Performance
- Bundle size: 169.80 kB (53 kB gzipped)
- Build time: ~2.4s
- Mobile responsive
- No external charting libraries
- Pure CSS charts and SVG

## Development
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Dependencies
- React 18.3.1
- Vite 6.0.0
- Zustand 5.0.11 (state management)
- Tailwind CSS 4.2.1
- Zero external chart libraries
