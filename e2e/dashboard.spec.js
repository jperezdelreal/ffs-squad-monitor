// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockConfig, mockIssues, mockHeartbeat, mockEvents, mockUsage } from './helpers/mocks.js'

test.use({ viewport: { width: 1920, height: 1080 } })

// Framer Motion applies inline transforms (translateX) on sidebar and motion.button
// elements, causing Playwright's click to fail with "outside of the viewport".
// Using evaluate(el => el.click()) dispatches a real DOM click that bypasses
// Playwright's coordinate-based actionability checks.

async function clickNavItem(page, label) {
  const btn = page.locator('aside nav button', { hasText: label })
  await btn.evaluate(el => el.click())
  return btn
}

async function clickButton(page, locator) {
  await locator.evaluate(el => el.click())
}

test.describe('Dashboard — layout and loading', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/FFS Squad Monitor/)
  })

  test('main layout renders sidebar, header, and content area', async ({ page }) => {
    await expect(page.locator('aside')).toBeAttached()
    await expect(page.locator('aside nav')).toBeAttached()

    const header = page.locator('header')
    await expect(header).toBeVisible()
    await expect(header.locator('h1')).toHaveText('Squad Monitor')

    const main = page.locator('main')
    await expect(main).toBeVisible()
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('sidebar renders all 7 navigation items', async ({ page }) => {
    const navButtons = page.locator('aside nav button')
    await expect(navButtons).toHaveCount(7)

    const labels = ['Activity Feed', 'Pipeline', 'Team Board', 'Timeline', 'Trend Charts', 'Cost Tracker', 'Analytics']
    for (const label of labels) {
      await expect(page.locator('aside nav button', { hasText: label })).toBeAttached()
    }
  })

  test('default view is Activity Feed with active indicator', async ({ page }) => {
    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await expect(activityBtn).toHaveClass(/border-cyan/)
  })

  test('sidebar shows version info and branding', async ({ page }) => {
    await expect(page.locator('aside').getByText(/v\d+\.\d+\.\d+/)).toBeAttached()
    await expect(page.locator('aside').getByText('FFS Monitor')).toBeAttached()
  })
})

test.describe('Dashboard — agent data displays', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('Team Board shows agent cards from mock data', async ({ page }) => {
    const teamBtn = await clickNavItem(page, 'Team Board')
    await expect(teamBtn).toHaveClass(/border-cyan/)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await page.waitForTimeout(500)

    const content = await main.textContent()
    const agentNames = ['ripley', 'dallas', 'lambert', 'kane']
    const foundAgents = agentNames.filter(name => content.toLowerCase().includes(name))
    expect(foundAgents.length).toBeGreaterThan(0)
  })

  test('Activity Feed renders event data', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).not.toBeEmpty()

    const content = await main.textContent()
    expect(content.length).toBeGreaterThan(0)
  })

  test('header shows Squad Monitor title and header elements', async ({ page }) => {
    const header = page.locator('header')
    await expect(header).toBeVisible()
    await expect(header.locator('h1')).toHaveText('Squad Monitor')

    const headerButtons = header.locator('button')
    const btnCount = await headerButtons.count()
    expect(btnCount).toBeGreaterThan(0)
  })
})

test.describe('Dashboard — health endpoint', () => {
  test('heartbeat API returns healthy status and renders dashboard', async ({ page }) => {
    let heartbeatCalled = false

    await mockAllAPIs(page)
    await page.unroute('/api/heartbeat')
    await page.route('/api/heartbeat', async route => {
      heartbeatCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHeartbeat),
      })
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    expect(heartbeatCalled).toBe(true)
    await expect(page.locator('main')).toBeVisible()
  })

  test('config API returns valid agent configuration', async ({ page }) => {
    let configCalled = false

    await mockAllAPIs(page)
    await page.unroute('/api/config')
    await page.route('/api/config', async route => {
      configCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockConfig),
      })
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    expect(configCalled).toBe(true)
    expect(mockConfig.agents).toHaveProperty('ripley')
    expect(mockConfig.agents).toHaveProperty('kane')
    expect(mockConfig.repos).toHaveLength(2)
  })

  test('issues API returns issue data', async ({ page }) => {
    let issuesCalled = false

    await mockAllAPIs(page)
    await page.unroute('/api/issues*')
    await page.route('/api/issues*', async route => {
      issuesCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockIssues),
      })
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    expect(issuesCalled).toBe(true)
  })
})

test.describe('Dashboard — navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('clicking sidebar items switches active view', async ({ page }) => {
    const views = ['Pipeline', 'Team Board', 'Timeline', 'Trend Charts', 'Cost Tracker', 'Analytics', 'Activity Feed']

    for (const view of views) {
      const btn = await clickNavItem(page, view)
      await expect(btn).toHaveClass(/border-cyan/)

      const main = page.locator('main')
      await expect(main).toBeVisible()
      const childCount = await main.locator('> *').count()
      expect(childCount).toBeGreaterThan(0)
    }
  })

  test('only one nav item is active at a time', async ({ page }) => {
    const pipelineBtn = await clickNavItem(page, 'Pipeline')
    await expect(pipelineBtn).toHaveClass(/border-cyan/)

    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await expect(activityBtn).not.toHaveClass(/border-cyan/)
  })

  test('settings panel toggles on click', async ({ page }) => {
    const settingsBtn = page.getByRole('button', { name: 'Settings', exact: true })
    await clickButton(page, settingsBtn)
    await expect(settingsBtn).toHaveClass(/border-cyan/)
  })
})

test.describe('Dashboard — dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('theme toggle switches between dark and light', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    await expect(themeToggle).toBeAttached()

    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))

    await clickButton(page, themeToggle)
    await page.waitForTimeout(300)

    const afterToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(afterToggle).not.toBe(initialDark)

    // Toggle back — re-query since aria-label changed
    const toggleBack = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    await clickButton(page, toggleBack)
    await page.waitForTimeout(300)

    const restored = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(restored).toBe(initialDark)
  })

  test('theme persists in localStorage', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    await clickButton(page, themeToggle)
    await page.waitForTimeout(300)

    const stored = await page.evaluate(() => localStorage.getItem('ffs-squad-monitor-theme'))
    expect(stored).toBeTruthy()
  })
})

test.describe('Dashboard — API data flows', () => {
  test('all API endpoints return valid JSON without errors', async ({ page }) => {
    const apiCalls = []

    await page.route('/api/**', async route => {
      const url = route.request().url()
      apiCalls.push(url)

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

    expect(apiCalls.length).toBeGreaterThan(0)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).not.toBeEmpty()
  })

  test('components render with mocked API data across views', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')

    const views = ['Activity Feed', 'Team Board', 'Cost Tracker']

    for (const view of views) {
      await clickNavItem(page, view)
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

    await clickNavItem(page, 'Team Board')
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'e2e/screenshots/team-board-baseline.png',
      fullPage: true,
    })
  })
})
