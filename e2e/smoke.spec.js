// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Dashboard smoke tests', () => {
  test('dashboard loads with header and sidebar', async ({ page }) => {
    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/')
    await expect(page.locator('h1')).toHaveText('Squad Monitor')
    await expect(page.locator('aside nav')).toBeVisible()

    // Sidebar should render all 7 nav items
    const navButtons = page.locator('aside nav button')
    await expect(navButtons).toHaveCount(7)

    // No uncaught JS errors (ignore network/API errors from missing backend)
    const codeErrors = consoleErrors.filter(
      (e) => !e.includes('fetch') && !e.includes('ERR_CONNECTION') && !e.includes('Failed to load') && !e.includes('NetworkError') && !e.includes('net::') && !e.includes('[API Error]')
    )
    expect(codeErrors).toHaveLength(0)
  })

  test('sidebar navigation switches views', async ({ page }) => {
    await page.goto('/')

    const views = [
      { label: 'Pipeline', marker: '🔄' },
      { label: 'Team Board', marker: '👥' },
      { label: 'Timeline', marker: '🎬' },
      { label: 'Trend Charts', marker: '📈' },
      { label: 'Cost Tracker', marker: '💰' },
      { label: 'Analytics', marker: '📉' },
      { label: 'Activity Feed', marker: '📊' },
    ]

    for (const view of views) {
      const btn = page.locator('aside nav button', { hasText: view.label })
      await btn.click()
      // Active button gets a special border style (cyan border)
      await expect(btn).toHaveClass(/border-cyan/)
      // Main content area should not be empty
      const main = page.locator('main')
      await expect(main).not.toBeEmpty()
    }
  })

  test('header displays health badge and connection status', async ({ page }) => {
    await page.goto('/')

    // Health badge area exists in header
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // "Squad Monitor" title
    await expect(header.locator('h1')).toHaveText('Squad Monitor')
    // "FFS Operations" subtitle
    await expect(header.getByText('FFS Operations')).toBeVisible()

    // Last update timestamp renders (shows "Never" or time)
    await expect(header.locator('.font-mono.text-xs')).toBeVisible()
  })

  test('activity feed renders on initial load', async ({ page }) => {
    await page.goto('/')

    // Activity Feed is the default view — should show content in main area
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).not.toBeEmpty()

    // Activity Feed button should be active (cyan border)
    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await expect(activityBtn).toHaveClass(/border-cyan/)
  })

  test('each view renders without crashing', async ({ page }) => {
    await page.goto('/')

    const navItems = [
      'Activity Feed',
      'Pipeline',
      'Team Board',
      'Timeline',
      'Trend Charts',
      'Cost Tracker',
      'Analytics',
    ]

    for (const label of navItems) {
      await page.locator('aside nav button', { hasText: label }).click()

      // View should render something inside main (loading state, content, or error — but not blank)
      const main = page.locator('main')
      await expect(main).toBeVisible()

      // Verify no blank page: main should have at least one child element
      const childCount = await main.locator('> *').count()
      expect(childCount).toBeGreaterThan(0)
    }
  })

  test('settings panel toggles', async ({ page }) => {
    await page.goto('/')

    const settingsBtn = page.locator('button', { hasText: 'Settings' })
    await expect(settingsBtn).toBeVisible()
    await settingsBtn.click()

    // Settings button should now have the active style
    await expect(settingsBtn).toHaveClass(/border-cyan/)
  })

  test('sidebar shows version info', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('aside').getByText(/v\d+\.\d+\.\d+/)).toBeVisible()
  })
})
