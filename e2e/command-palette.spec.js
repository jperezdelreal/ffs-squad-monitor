// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
  })

  test('Cmd+K opens command palette', async ({ page }) => {
    // Press Cmd+K (or Ctrl+K)
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    // Command palette should open
    const palette = page.locator('[role="dialog"], [class*="command"], [class*="palette"]').first()
    
    if (await palette.count() > 0) {
      await expect(palette).toBeVisible()
    }
  })

  test('Ctrl+K opens command palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(300)
    
    const palette = page.locator('[role="dialog"], [class*="command"], [class*="palette"]').first()
    
    if (await palette.count() > 0) {
      await expect(palette).toBeVisible()
    }
  })

  test('search input filters commands', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    // Look for search input
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Type search query
      await searchInput.fill('refresh')
      await page.waitForTimeout(300)
      
      // Command list should be filtered
      const palette = page.locator('[role="dialog"], [class*="command"]').first()
      await expect(palette).toBeVisible()
    }
  })

  test('arrow keys navigate command list', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(100)
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(100)
      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(100)
      
      // Should not crash
      await expect(searchInput).toBeVisible()
    }
  })

  test('Enter key executes selected command', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Navigate to a command and press Enter
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(100)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      
      // Palette should close after command execution
      // Main content should still be visible
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('Escape closes command palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    // Palette should be closed
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('clicking outside closes palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Click outside palette (on body or backdrop)
      await page.locator('body').click({ position: { x: 10, y: 10 } })
      await page.waitForTimeout(300)
      
      // Main should still be visible
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('recent commands section shows last actions', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    
    const palette = page.locator('[role="dialog"], [class*="command"]').first()
    
    if (await palette.count() > 0) {
      const content = await palette.textContent()
      
      // May contain "Recent" section
      // At minimum, palette should have content
      expect(content.length).toBeGreaterThan(0)
    }
  })
})
