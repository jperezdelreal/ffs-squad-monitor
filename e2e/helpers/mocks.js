// Mock data for E2E tests
// Stable, consistent mock data for predictable test assertions

export const mockHeartbeat = {
  status: 'running',
  round: 42,
  pid: 12345,
  interval: 300000,
  lastStatus: 'success',
  lastDuration: 5234,
  timestamp: new Date().toISOString(),
  consecutiveFailures: 0,
  mode: 'production',
  repos: ['ffs-squad-monitor', 'FirstFrameStudios']
}

export const mockEvents = [
  {
    id: '12345678',
    type: 'PushEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'ripley',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    payload: {
      commits: [{ message: 'feat: Add dashboard filters' }]
    }
  },
  {
    id: '12345679',
    type: 'PullRequestEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'dallas',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    payload: {
      action: 'opened',
      pull_request: {
        number: 42,
        title: 'Fix: Header layout on mobile',
        state: 'open'
      }
    }
  },
  {
    id: '12345680',
    type: 'IssuesEvent',
    repo: 'jperezdelreal/ffs-squad-monitor',
    actor: 'kane',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    payload: {
      action: 'closed',
      issue: {
        number: 38,
        title: 'Fix CI blockers'
      }
    }
  }
]

export const mockIssues = [
  {
    repo: 'ffs-squad-monitor',
    repoLabel: 'Squad Monitor',
    repoEmoji: '👁️',
    number: 171,
    title: 'E2E Testing - Expand Playwright Coverage',
    state: 'open',
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/171',
    priority: 0,
    labels: ['squad:kane', 'priority:P0', 'type:feature', 'Issues'],
    assignees: ['kane'],
    prStatus: 'none',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    repo: 'ffs-squad-monitor',
    repoLabel: 'Squad Monitor',
    repoEmoji: '👁️',
    number: 42,
    title: 'Real-time cost tracking widget',
    state: 'open',
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/42',
    priority: 1,
    labels: ['squad:lambert', 'priority:P1', 'type:feature', 'Code'],
    assignees: ['lambert'],
    prStatus: 'open',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    repo: 'ffs-squad-monitor',
    repoLabel: 'Squad Monitor',
    repoEmoji: '👁️',
    number: 55,
    title: 'Mobile responsive navigation',
    state: 'open',
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/55',
    priority: 2,
    labels: ['squad:dallas', 'priority:P2', 'type:feature', 'Build', 'blocked-by:dependencies'],
    assignees: ['dallas'],
    prStatus: 'none',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 90000000).toISOString()
  },
  {
    repo: 'ffs-squad-monitor',
    repoLabel: 'Squad Monitor',
    repoEmoji: '👁️',
    number: 33,
    title: 'Documentation: Architecture guide',
    state: 'open',
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/33',
    priority: 3,
    labels: ['priority:P3', 'type:docs', 'Proposal'],
    assignees: [],
    prStatus: 'none',
    createdAt: new Date(Date.now() - 432000000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    repo: 'ffs-squad-monitor',
    repoLabel: 'Squad Monitor',
    repoEmoji: '👁️',
    number: 28,
    title: 'Implement SSE reconnection logic',
    state: 'open',
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/28',
    priority: 1,
    labels: ['squad:ripley', 'priority:P1', 'type:feature', 'GDD'],
    assignees: ['ripley'],
    prStatus: 'none',
    createdAt: new Date(Date.now() - 518400000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString()
  },
  {
    repo: 'ffs-squad-monitor',
    repoLabel: 'Squad Monitor',
    repoEmoji: '👁️',
    number: 19,
    title: 'Analytics: Sprint velocity chart',
    state: 'open',
    url: 'https://github.com/jperezdelreal/ffs-squad-monitor/issues/19',
    priority: 2,
    labels: ['priority:P2', 'type:feature', 'Code'],
    assignees: [],
    prStatus: 'none',
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    updatedAt: new Date(Date.now() - 345600000).toISOString()
  }
]

export const mockConfig = {
  repos: [
    { id: 'ffs-squad-monitor', emoji: '👁️', label: 'Squad Monitor', github: 'jperezdelreal/ffs-squad-monitor', hasSquad: true, focus: true },
    { id: 'FirstFrameStudios', emoji: '🎬', label: 'FFS Hub', github: 'jperezdelreal/FirstFrameStudios', hasSquad: true, focus: false }
  ],
  agents: {
    ripley: { emoji: '🦁', role: 'Lead', color: '#ff6b6b', assignedRepo: null },
    dallas: { emoji: '🎨', role: 'Frontend Dev', color: '#51cf66', assignedRepo: null },
    lambert: { emoji: '⚙️', role: 'Backend Dev', color: '#339af0', assignedRepo: null },
    kane: { emoji: '🧪', role: 'Tester', color: '#ffa94d', assignedRepo: null }
  }
}

export const mockUsage = {
  source: 'billing',
  totalMinutesUsed: 1850,
  includedMinutes: 2000,
  paidMinutesUsed: 0,
  percentage: 92.5,
  repos: [
    { repo: 'ffs-squad-monitor', minutes: 1200 },
    { repo: 'FirstFrameStudios', minutes: 650 }
  ]
}

export const mockMetricsIssues = {
  channel: 'issues',
  interval: '1h',
  from: new Date(Date.now() - 86400000).toISOString(),
  to: new Date().toISOString(),
  count: 24,
  data: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
    data: {
      open: 15 + Math.floor(Math.random() * 5),
      closed: 2 + Math.floor(Math.random() * 3),
      total: 17 + Math.floor(Math.random() * 8)
    }
  }))
}

export const mockPulse = {
  prsMergedToday: 5,
  issuesClosedToday: 3,
  activeAgents: 3,
  totalAgents: 4
}

export const mockTimeline = {
  date: new Date().toISOString().split('T')[0],
  agents: ['ripley', 'dallas', 'lambert', 'kane'],
  rounds: [
    {
      round: 1,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      duration: 4500,
      status: 'success',
      agents: {
        ripley: { status: 'active', task: 'Issue #171' },
        dallas: { status: 'idle' },
        lambert: { status: 'active', task: 'PR review' },
        kane: { status: 'active', task: 'E2E tests' }
      }
    }
  ],
  heartbeat: { status: 'running', round: 42 },
  summary: {
    total: 1,
    success: 1,
    error: 0,
    avgDuration: 4500,
    maxDuration: 4500
  }
}

// Mock API route helper for Playwright
export async function mockAllAPIs(page) {
  await page.route('/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' })
    })
  })

  await page.route('/api/heartbeat', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHeartbeat)
    })
  })

  await page.route('/api/events', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockEvents)
    })
  })

  await page.route('/api/issues*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockIssues)
    })
  })

  await page.route('/api/board*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockIssues)
    })
  })

  await page.route('/api/config', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockConfig)
    })
  })

  await page.route('/api/usage', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsage)
    })
  })

  await page.route('/api/metrics*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMetricsIssues)
    })
  })

  await page.route('/api/pulse', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPulse)
    })
  })

  await page.route('/api/timeline*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTimeline)
    })
  })

  // Block SSE to prevent connection attempts in tests
  await page.route('/api/sse*', async route => {
    await route.abort('blockedbyclient')
  })

  await page.route('/api/logs*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    })
  })
}
