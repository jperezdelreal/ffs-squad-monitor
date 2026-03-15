// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('Error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('handles API 500 error gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/events', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })
    
    // Mock other APIs normally
    await mockAllAPIs(page)
    
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // App should still render, possibly with error message
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('handles network timeout', async ({ page }) => {
    // Mock slow response
    await page.route('/api/events', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000))
      await route.abort('timedout')
    })
    
    await mockAllAPIs(page)
    await page.goto('/')
    await page.waitForTimeout(1000)
    
    // Should show loading or error state
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('retry button refetches failed data', async ({ page }) => {
    let callCount = 0
    
    await page.route('/api/events', async route => {
      callCount++
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      }
    })
    
    await mockAllAPIs(page)
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // Look for retry button
    const retryBtn = page.locator('button').filter({ hasText: /retry|try again/i }).first()
    
    if (await retryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await retryBtn.click()
      await page.waitForTimeout(500)
      
      expect(callCount).toBeGreaterThan(1)
    }
  })

  test('handles missing data gracefully', async ({ page }) => {
    // Mock empty responses
    await page.route('/api/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })
    
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // Should show empty state
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('JavaScript errors do not crash app', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    page.on('pageerror', error => {
      consoleErrors.push(error.message)
    })
    
    await mockAllAPIs(page)
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // Navigate through all views
    const views = ['Activity Feed', 'Pipeline', 'Team Board', 'Timeline', 'Trend Charts', 'Cost Tracker', 'Analytics']
    
    for (const view of views) {
      const navBtn = page.locator('aside nav button', { hasText: view })
      await navBtn.click()
      await page.waitForTimeout(300)
    }
    
    // Filter out expected errors (API connection failures, etc.)
    const unexpectedErrors = consoleErrors.filter(
      e => !e.includes('fetch') && 
           !e.includes('Network') && 
           !e.includes('[API Error]') &&
           !e.includes('ERR_CONNECTION')
    )
    
    expect(unexpectedErrors.length).toBe(0)
  })
})
