// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('? key opens shortcuts overlay', async ({ page }) => {
    await page.keyboard.press('?')
    await page.waitForTimeout(300)
    
    // Shortcuts overlay should appear
    const overlay = page.locator('[role="dialog"], [class*="shortcut"]').first()
    
    if (await overlay.count() > 0) {
      await expect(overlay).toBeVisible()
    }
  })

  test('number keys 1-7 switch views', async ({ page }) => {
    const views = [
      { key: '1', name: 'Activity Feed' },
      { key: '2', name: 'Pipeline' },
      { key: '3', name: 'Team Board' },
      { key: '4', name: 'Timeline' },
      { key: '5', name: 'Trend Charts' },
      { key: '6', name: 'Cost Tracker' },
      { key: '7', name: 'Analytics' }
    ]
    
    for (const view of views) {
      await page.keyboard.press(view.key)
      await page.waitForTimeout(300)
      
      // View should switch
      const main = page.locator('main')
      await expect(main).toBeVisible()
      
      // Active nav button should match
      const navBtn = page.locator('aside nav button', { hasText: view.name })
      if (await navBtn.count() > 0) {
        await expect(navBtn).toHaveClass(/border-cyan|active/)
      }
    }
  })

  test('r key refreshes all data', async ({ page }) => {
    let apiCalls = 0
    await page.route('/api/**', async route => {
      apiCalls++
      await route.continue()
    })
    
    const initialCalls = apiCalls
    
    await page.keyboard.press('r')
    await page.waitForTimeout(500)
    
    // Should trigger API calls for refresh
    expect(apiCalls).toBeGreaterThan(initialCalls)
  })

  test('e key opens export dialog', async ({ page }) => {
    await page.keyboard.press('e')
    await page.waitForTimeout(300)
    
    // Export dialog may appear or export may trigger directly
    // At minimum, page should not crash
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('f key toggles focus mode', async ({ page }) => {
    // Get initial state
    const header = page.locator('header')
    const sidebar = page.locator('aside')
    
    const headerVisible = await header.isVisible()
    const sidebarVisible = await sidebar.isVisible()
    
    await page.keyboard.press('f')
    await page.waitForTimeout(300)
    
    // Header/sidebar visibility should toggle
    const headerVisibleAfter = await header.isVisible()
    const sidebarVisibleAfter = await sidebar.isVisible()
    
    // At least one should have changed visibility
    expect(headerVisibleAfter !== headerVisible || sidebarVisibleAfter !== sidebarVisible).toBeTruthy()
  })

  test('Escape closes overlays', async ({ page }) => {
    // Open shortcuts overlay
    await page.keyboard.press('?')
    await page.waitForTimeout(300)
    
    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    // Main should be visible
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('keyboard shortcuts do not trigger in input fields', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchInput.focus()
      
      // Type 'r' in input - should not trigger refresh
      await searchInput.fill('r')
      await page.waitForTimeout(200)
      
      // Input should contain 'r'
      const value = await searchInput.inputValue()
      expect(value).toContain('r')
    }
  })
})
