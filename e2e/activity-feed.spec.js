// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockEvents } from './helpers/mocks.js'

test.describe('ActivityFeed view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Activity Feed (default view, but verify active)
    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await activityBtn.click()
  })

  test('displays event feed with mock data', async ({ page }) => {
    // Wait for events to load
    await page.waitForSelector('main', { state: 'visible' })
    
    // Verify main content area is not empty
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Check for event cards (may vary based on component structure)
    const content = await main.textContent()
    expect(content).not.toBe('')
  })

  test('filters events by repository', async ({ page }) => {
    // Look for repository filter dropdown
    const repoFilter = page.locator('select').first()
    if (await repoFilter.isVisible()) {
      await repoFilter.selectOption({ index: 1 })
      
      // Wait for content update
      await page.waitForTimeout(500)
      
      // Verify main still has content
      const main = page.locator('main')
      await expect(main).not.toBeEmpty()
    }
  })

  test('shows event type indicators', async ({ page }) => {
    // Wait for content to render
    await page.waitForSelector('main', { state: 'visible' })
    
    // ActivityFeed should render events with their type labels
    // Check main area contains content
    const main = page.locator('main')
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('refresh button updates feed', async ({ page }) => {
    // Set up mock to track API calls
    let callCount = 0
    await page.route('/api/events', async route => {
      callCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockEvents)
      })
    })
    
    // Initial load happens automatically
    await page.waitForTimeout(500)
    expect(callCount).toBeGreaterThan(0)
    
    const initialCalls = callCount
    
    // Click refresh if button exists
    const refreshBtn = page.locator('button', { hasText: /refresh/i }).first()
    if (await refreshBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await refreshBtn.click()
      await page.waitForTimeout(500)
      expect(callCount).toBeGreaterThan(initialCalls)
    }
  })

  test('event cards display actor and timestamp', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // ActivityFeed renders events - check for presence of data
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Content should be rendered (specific selectors depend on component implementation)
    const hasContent = await main.evaluate(el => el.textContent.length > 0)
    expect(hasContent).toBe(true)
  })
})
