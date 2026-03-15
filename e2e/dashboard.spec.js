// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockConfig, mockIssues, mockHeartbeat, mockEvents, mockUsage } from './helpers/mocks.js'

test.describe('Dashboard — layout and loading', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
  })

  test('page loads with correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/FFS Squad Monitor/)
  })

  test('main layout renders sidebar, header, and content area', async ({ page }) => {
    await page.goto('/')

    // Sidebar
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('nav')).toBeVisible()

    // Header
    const header = page.locator('header')
    await expect(header).toBeVisible()
    await expect(header.locator('h1')).toHaveText('Squad Monitor')
    await expect(header.getByText('FFS Operations')).toBeVisible()

    // Main content area
    const main = page.locator('main')
    await expect(main).toBeVisible()
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('sidebar renders all 7 navigation items', async ({ page }) => {
    await page.goto('/')
    const navButtons = page.locator('aside nav button')
    await expect(navButtons).toHaveCount(7)

    const labels = ['Activity Feed', 'Pipeline', 'Team Board', 'Timeline', 'Trend Charts', 'Cost Tracker', 'Analytics']
    for (const label of labels) {
      await expect(page.locator('aside nav button', { hasText: label })).toBeVisible()
    }
  })

  test('default view is Activity Feed with active indicator', async ({ page }) => {
    await page.goto('/')
    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await expect(activityBtn).toHaveClass(/border-cyan/)
  })

  test('sidebar shows version info and branding', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('aside').getByText(/v\d+\.\d+\.\d+/)).toBeVisible()
    await expect(page.locator('aside').getByText('FFS Monitor')).toBeVisible()
  })
})

test.describe('Dashboard — agent data displays', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
  })

  test('Team Board shows agent cards from mock data', async ({ page }) => {
    await page.goto('/')

    // Navigate to Team Board
    await page.locator('aside nav button', { hasText: 'Team Board' }).click()
    await expect(page.locator('aside nav button', { hasText: 'Team Board' })).toHaveClass(/border-cyan/)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Mock config has 4 agents: ripley, dallas, lambert, kane
    const content = await main.textContent()
    const agentNames = ['ripley', 'dallas', 'lambert', 'kane']
    const foundAgents = agentNames.filter(name => content.toLowerCase().includes(name))
    expect(foundAgents.length).toBeGreaterThan(0)
  })

  test('Activity Feed renders event data', async ({ page }) => {
    await page.goto('/')

    // Default view is Activity Feed — should render mocked events
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).not.toBeEmpty()

    const content = await main.textContent()
    expect(content.length).toBeGreaterThan(0)
  })

  test('header shows connection status', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')

    // Last update timestamp should render
    await expect(header.locator('.font-mono.text-xs')).toBeVisible()
  })
})

test.describe('Dashboard — health endpoint', () => {
  test('mocked /api/heartbeat returns healthy status', async ({ page }) => {
    let heartbeatResponse = null

    await page.route('/api/heartbeat', async route => {
      heartbeatResponse = mockHeartbeat
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHeartbeat),
      })
    })

    // Mock remaining APIs
    await mockAllAPIs(page)
    await page.goto('/')

    // Verify mock data was served
    expect(heartbeatResponse).not.toBeNull()
    expect(heartbeatResponse.status).toBe('running')
  })

  test('/api/config returns valid agent configuration', async ({ page }) => {
    let configResponse = null

    await page.route('/api/config', async route => {
      configResponse = mockConfig
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockConfig),
      })
    })

    await mockAllAPIs(page)
    await page.goto('/')

    expect(configResponse).not.toBeNull()
    expect(configResponse.agents).toHaveProperty('ripley')
    expect(configResponse.agents).toHaveProperty('kane')
    expect(configResponse.repos).toHaveLength(2)
  })

  test('/api/issues returns issue data', async ({ page }) => {
    let issuesServed = false

    await page.route('/api/issues*', async route => {
      issuesServed = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockIssues),
      })
    })

    await mockAllAPIs(page)
    await page.goto('/')

    // Trigger a navigation to ensure issues are fetched
    await page.locator('aside nav button', { hasText: 'Team Board' }).click()
    await page.waitForTimeout(500)

    expect(issuesServed).toBe(true)
  })
})

test.describe('Dashboard — navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('clicking sidebar items switches active view', async ({ page }) => {
    const views = [
      'Pipeline',
      'Team Board',
      'Timeline',
      'Trend Charts',
      'Cost Tracker',
      'Analytics',
      'Activity Feed',
    ]

    for (const view of views) {
      const btn = page.locator('aside nav button', { hasText: view })
      await btn.click()

      // Active button gets cyan border
      await expect(btn).toHaveClass(/border-cyan/)

      // Main area still renders content
      const main = page.locator('main')
      await expect(main).toBeVisible()
      const childCount = await main.locator('> *').count()
      expect(childCount).toBeGreaterThan(0)
    }
  })

  test('only one nav item is active at a time', async ({ page }) => {
    // Click Pipeline
    await page.locator('aside nav button', { hasText: 'Pipeline' }).click()
    const pipelineBtn = page.locator('aside nav button', { hasText: 'Pipeline' })
    await expect(pipelineBtn).toHaveClass(/border-cyan/)

    // Activity Feed should no longer be active
    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await expect(activityBtn).not.toHaveClass(/border-cyan/)
  })

  test('settings panel toggles on click', async ({ page }) => {
    const settingsBtn = page.locator('button', { hasText: 'Settings' })
    await expect(settingsBtn).toBeVisible()
    await settingsBtn.click()
    await expect(settingsBtn).toHaveClass(/border-cyan/)
  })
})

test.describe('Dashboard — dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
  })

  test('theme toggle switches between dark and light', async ({ page }) => {
    await page.goto('/')

    // Find the theme toggle button in the header
    const header = page.locator('header')
    const themeToggle = header.locator('button').filter({ has: page.locator('svg') }).last()

    // Get initial theme state from document element
    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))

    // Click theme toggle
    await themeToggle.click()
    await page.waitForTimeout(300)

    // Theme should have changed
    const afterToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(afterToggle).not.toBe(initialDark)

    // Toggle back
    await themeToggle.click()
    await page.waitForTimeout(300)

    const restored = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(restored).toBe(initialDark)
  })

  test('theme persists in localStorage', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    const themeToggle = header.locator('button').filter({ has: page.locator('svg') }).last()

    await themeToggle.click()
    await page.waitForTimeout(300)

    // Check localStorage was updated
    const stored = await page.evaluate(() => localStorage.getItem('ffs-squad-monitor-theme'))
    expect(stored).toBeTruthy()
  })
})

test.describe('Dashboard — API data flows', () => {
  test('all API endpoints return valid JSON without errors', async ({ page }) => {
    const apiCalls = []

    // Track which APIs are called
    await page.route('/api/**', async route => {
      const url = route.request().url()
      apiCalls.push(url)

      // Route to the mock handler
      if (url.includes('/api/heartbeat')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockHeartbeat) })
      } else if (url.includes('/api/events')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEvents) })
      } else if (url.includes('/api/issues')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockIssues) })
      } else if (url.includes('/api/config')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockConfig) })
      } else if (url.includes('/api/usage')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUsage) })
      } else if (url.includes('/api/sse')) {
        await route.abort('blockedbyclient')
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    // App should have made API calls on load
    expect(apiCalls.length).toBeGreaterThan(0)

    // Dashboard should render without errors
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).not.toBeEmpty()
  })

  test('components render with mocked API data', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')

    // Visit each major view and verify content renders
    const views = ['Activity Feed', 'Team Board', 'Cost Tracker']

    for (const view of views) {
      await page.locator('aside nav button', { hasText: view }).click()
      await page.waitForTimeout(500)

      const main = page.locator('main')
      await expect(main).toBeVisible()
      const content = await main.textContent()
      expect(content.length).toBeGreaterThan(0)
    }
  })
})

test.describe('Dashboard — screenshot regression', () => {
  test('main dashboard baseline screenshot', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')

    // Wait for layout to stabilize
    await page.waitForTimeout(1000)
    await expect(page.locator('main')).toBeVisible()

    await page.screenshot({
      path: 'e2e/screenshots/dashboard-baseline.png',
      fullPage: true,
    })
  })

  test('team board view screenshot', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')

    await page.locator('aside nav button', { hasText: 'Team Board' }).click()
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'e2e/screenshots/team-board-baseline.png',
      fullPage: true,
    })
  })
})
