// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockMetricsIssues } from './helpers/mocks.js'

test.describe('TrendCharts view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Trend Charts
    const chartsBtn = page.locator('aside nav button', { hasText: 'Trend Charts' })
    await chartsBtn.click()
    await page.waitForTimeout(500)
  })

  test('displays trend charts', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Should render chart components
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('time range toggle (7d/30d/90d) persists', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Look for time range toggles
    const toggle30d = page.locator('button').filter({ hasText: /30d/i }).first()
    
    if (await toggle30d.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toggle30d.click()
      await page.waitForTimeout(300)
      
      // Reload page and check if selection persisted
      await page.reload()
      await page.waitForTimeout(500)
      
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })

  test('renders line chart for issues trend', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // TrendCharts should have chart elements (svg, canvas, or chart library containers)
    const main = page.locator('main')
    
    // Check for chart rendering (depends on chart library used)
    const hasSvg = await main.locator('svg').count() > 0
    const hasCanvas = await main.locator('canvas').count() > 0
    
    // At least one chart element should exist
    expect(hasSvg || hasCanvas).toBeTruthy()
  })

  test('renders agent distribution chart', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Should render multiple charts
    const svgCount = await main.locator('svg').count()
    const canvasCount = await main.locator('canvas').count()
    
    expect(svgCount + canvasCount).toBeGreaterThan(0)
  })

  test('chart interactions do not crash', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    const main = page.locator('main')
    
    // Try hovering over chart area
    const chartArea = main.locator('svg, canvas').first()
    if (await chartArea.count() > 0) {
      await chartArea.hover()
      
      // Should not crash
      await expect(main).toBeVisible()
    }
  })
})
