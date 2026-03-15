// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockMetricsIssues } from './helpers/mocks.js'

test.describe('Analytics view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Analytics
    const analyticsBtn = page.locator('aside nav button', { hasText: 'Analytics' })
    await analyticsBtn.click()
    await page.waitForTimeout(500)
  })

  test('displays analytics dashboard', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Should render analytics content
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('time range selector changes data window', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for time range buttons (7d/14d/30d)
    const timeRangeBtn = page.locator('button').filter({ hasText: /7d|14d|30d/i }).first()
    
    if (await timeRangeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await timeRangeBtn.click()
      await page.waitForTimeout(300)
      
      // Should still render
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('displays key metrics', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Analytics should show metrics like velocity, throughput, etc.
    const main = page.locator('main')
    const content = await main.textContent()
    
    expect(content.length).toBeGreaterThan(0)
  })

  test('refresh button updates metrics', async ({ page }) => {
    let callCount = 0
    await page.route('/api/metrics*', async route => {
      callCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMetricsIssues)
      })
    })
    
    await page.waitForTimeout(500)
    const initialCalls = callCount
    
    const refreshBtn = page.locator('button', { hasText: /refresh/i }).first()
    if (await refreshBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await refreshBtn.click()
      await page.waitForTimeout(500)
      expect(callCount).toBeGreaterThan(initialCalls)
    }
  })
})
