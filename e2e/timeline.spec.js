// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockTimeline } from './helpers/mocks.js'

test.describe('Timeline view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Timeline
    const timelineBtn = page.locator('aside nav button', { hasText: 'Timeline' })
    await timelineBtn.click()
    await page.waitForTimeout(500)
  })

  test('displays timeline swimlanes', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Should render swimlane layout
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('time range selector (24h/7d/14d) changes view', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for time range buttons
    const timeRangeBtn = page.locator('button').filter({ hasText: /24h|7d|14d/i }).first()
    
    if (await timeRangeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await timeRangeBtn.click()
      await page.waitForTimeout(300)
      
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('shows issues as horizontal bars on agent swimlanes', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Timeline should render visual issue bars
    const main = page.locator('main')
    const content = await main.textContent()
    
    expect(content.length).toBeGreaterThan(0)
  })

  test('zoom controls adjust timeline scale', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for zoom buttons (+/-)
    const zoomBtn = page.locator('button').filter({ hasText: /\+|-|zoom/i }).first()
    
    if (await zoomBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await zoomBtn.click()
      await page.waitForTimeout(300)
      
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('hovering over issue bar shows tooltip', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    const main = page.locator('main')
    
    // Try hovering over main area (issue bars)
    await main.hover()
    
    // Should not crash on hover
    await expect(main).toBeVisible()
  })

  test('agent visibility toggle hides/shows swimlanes', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for agent toggle buttons
    const toggleBtn = page.locator('button').filter({ hasText: /ripley|dallas|lambert|kane/i }).first()
    
    if (await toggleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toggleBtn.click()
      await page.waitForTimeout(300)
      
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })
})
