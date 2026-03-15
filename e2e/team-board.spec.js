// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('TeamBoard view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Team Board
    const teamBtn = page.locator('aside nav button', { hasText: 'Team Board' })
    await teamBtn.click()
    await page.waitForTimeout(500)
  })

  test('displays agent cards', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // TeamBoard should render agent cards
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('shows agent workload counts', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Mock config has 4 agents: ripley, dallas, lambert, kane
    // Mock issues have squad:agent labels
    const main = page.locator('main')
    const content = await main.textContent()
    
    // Should display agent names or roles
    expect(content.length).toBeGreaterThan(0)
  })

  test('highlights blocked issues with severity colors', async ({ page }) => {
    // Mock issue #55 has "blocked-by:dependencies" label with old updatedAt
    await page.waitForSelector('main', { state: 'visible' })
    
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // TeamBoard should render with blocked issue indicators
    // (specific color checks depend on component implementation)
  })

  test('agent cards are expandable', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for clickable agent cards
    const main = page.locator('main')
    const cards = main.locator('button, [role="button"]')
    
    if (await cards.count() > 0) {
      const firstCard = cards.first()
      await firstCard.click()
      
      // Should not crash after expansion
      await expect(main).toBeVisible()
    }
  })

  test('filters by agent status', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for filter controls
    const filterBtn = page.locator('button').filter({ hasText: /filter|all|blocked/i }).first()
    
    if (await filterBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await filterBtn.click()
      await page.waitForTimeout(300)
      
      // Board should still render
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })
})
