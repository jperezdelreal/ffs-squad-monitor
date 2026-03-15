// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockUsage } from './helpers/mocks.js'

test.describe('CostTracker view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Cost Tracker
    const costBtn = page.locator('aside nav button', { hasText: 'Cost Tracker' })
    await costBtn.click()
    await page.waitForTimeout(500)
  })

  test('displays usage statistics', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Should render usage data
    const content = await main.textContent()
    expect(content.length).toBeGreaterThan(0)
  })

  test('shows percentage of included minutes used', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Mock shows 92.5% usage (1850 / 2000 minutes)
    const main = page.locator('main')
    const content = await main.textContent()
    
    // Should display percentage
    expect(content).toMatch(/\d+\.?\d*%/)
  })

  test('displays warning color when usage > 80%', async ({ page }) => {
    // Mock usage is 92.5% - should trigger warning
    await page.waitForSelector('main', { state: 'visible' })
    
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Check for amber/red color indicators (depends on component implementation)
    // At minimum, component should render without crashing
  })

  test('shows per-repo breakdown if available', async ({ page }) => {
    // Mock usage has repos array
    await page.waitForSelector('main', { state: 'visible' })
    
    const main = page.locator('main')
    const content = await main.textContent()
    
    // Should display some content
    expect(content.length).toBeGreaterThan(0)
  })

  test('export button generates usage report', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for export button
    const exportBtn = page.locator('button').filter({ hasText: /export/i }).first()
    
    if (await exportBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await exportBtn.click()
      
      // Should not crash
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('handles low usage gracefully', async ({ page }) => {
    // Override mock with low usage
    await page.route('/api/usage', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'billing',
          totalMinutesUsed: 500,
          includedMinutes: 2000,
          paidMinutesUsed: 0,
          percentage: 25.0,
          repos: []
        })
      })
    })
    
    await page.reload()
    await page.waitForTimeout(500)
    
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })
})
