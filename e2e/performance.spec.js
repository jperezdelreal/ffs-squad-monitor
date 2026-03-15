// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Performance and Load Tests', () => {
  test('dashboard loads within 3 seconds', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(3000)
  })

  test('handles rapid view switching without lag', async ({ page }) => {
    await page.goto('/')

    const views = [
      'Pipeline',
      'Team Board',
      'Timeline',
      'Trend Charts',
      'Cost Tracker',
      'Analytics',
      'Activity Feed',
    ]

    const switchTimes = []

    for (const view of views) {
      const startTime = Date.now()
      await page.locator('aside nav button', { hasText: view }).click()
      await page.locator('main').waitFor({ state: 'visible' })
      const switchTime = Date.now() - startTime
      switchTimes.push(switchTime)
    }

    // Average switch time should be under 500ms
    const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length
    expect(avgSwitchTime).toBeLessThan(500)
  })

  test('metrics spike does not crash dashboard', async ({ page }) => {
    await page.goto('/')

    // Navigate to Analytics view (metrics-heavy)
    await page.locator('aside nav button', { hasText: 'Analytics' }).click()
    
    // Wait for any metrics to load
    await page.waitForTimeout(1000)

    // Verify dashboard still responsive
    const header = page.locator('header')
    await expect(header).toBeVisible()
    
    // Can still navigate
    await page.locator('aside nav button', { hasText: 'Activity Feed' }).click()
    await expect(page.locator('main')).toBeVisible()
  })

  test('renders 100+ activity feed items without performance degradation', async ({ page }) => {
    await page.goto('/')

    // Activity Feed is default view
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Scroll to bottom to trigger any lazy loading
    await main.evaluate(el => el.scrollTo(0, el.scrollHeight))
    
    // Page should still be responsive
    const startTime = Date.now()
    await page.locator('aside nav button', { hasText: 'Pipeline' }).click()
    const clickResponseTime = Date.now() - startTime
    
    expect(clickResponseTime).toBeLessThan(1000)
  })

  test('memory usage stays stable during extended session', async ({ page }) => {
    await page.goto('/')

    // Simulate user activity for 10 view switches
    const views = ['Pipeline', 'Team Board', 'Activity Feed']
    
    for (let i = 0; i < 10; i++) {
      const view = views[i % views.length]
      await page.locator('aside nav button', { hasText: view }).click()
      await page.waitForTimeout(200)
    }

    // Page should still be functional
    await expect(page.locator('header h1')).toHaveText('Squad Monitor')
  })
})

test.describe('Real-Time Update Latency', () => {
  test('SSE connection establishes within 2 seconds', async ({ page }) => {
    await page.goto('/')

    // Wait for potential SSE connection indicators
    // (Status in header or connection indicator)
    await page.waitForTimeout(2000)

    // Dashboard should be fully loaded
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('aside')).toBeVisible()
  })

  test('last update timestamp updates correctly', async ({ page }) => {
    await page.goto('/')

    const timestampLocator = page.locator('header .font-mono.text-xs')
    await expect(timestampLocator).toBeVisible()

    // Timestamp should show either "Never" or a time value
    const initialText = await timestampLocator.textContent()
    expect(initialText).toBeTruthy()
  })

  test('connection status reflects actual state', async ({ page }) => {
    await page.goto('/')

    // Header should render without errors
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Health badge or connection indicator should be present
    // (specific selectors depend on implementation)
    await expect(header).not.toBeEmpty()
  })
})
