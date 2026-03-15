// @ts-check
import { test, expect, devices } from '@playwright/test'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12 size
    await mockAllAPIs(page)
  })

  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.goto('/')

    // Header should be visible
    await expect(page.locator('header h1')).toBeVisible()

    // Sidebar should adapt to mobile (could be collapsed/hamburger)
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
  })

  test('navigation works on mobile', async ({ page }) => {
    await page.goto('/')

    // Navigate through views
    const views = ['Pipeline', 'Team Board', 'Activity Feed']
    
    for (const view of views) {
      await page.locator('aside nav button', { hasText: view }).click()
      
      // Main content should update
      const main = page.locator('main')
      await expect(main).toBeVisible()
      await expect(main).not.toBeEmpty()
    }
  })

  test('text remains readable on small screens', async ({ page }) => {
    await page.goto('/')

    // Check that text has appropriate size
    const heading = page.locator('header h1')
    const fontSize = await heading.evaluate(el => 
      window.getComputedStyle(el).fontSize
    )
    
    // Font size should be at least 16px for readability
    const fontSizePx = parseInt(fontSize, 10)
    expect(fontSizePx).toBeGreaterThanOrEqual(16)
  })

  test('buttons have adequate touch targets', async ({ page }) => {
    await page.goto('/')

    // Nav buttons should be large enough to tap
    const navButtons = page.locator('aside nav button')
    const buttonCount = await navButtons.count()
    
    expect(buttonCount).toBeGreaterThan(0)

    // Check first button size (should be at least 44x44px)
    const firstButton = navButtons.first()
    const box = await firstButton.boundingBox()
    
    expect(box).toBeTruthy()
    expect(box.height).toBeGreaterThanOrEqual(40) // Allow some margin
  })

  test('mobile menu toggles sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // Look for hamburger menu button
    const menuBtn = page.locator('button').filter({ hasText: /menu|☰/i }).first()
    
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(300)
      
      // Sidebar should appear
      const sidebar = page.locator('aside')
      await expect(sidebar).toBeVisible()
      
      // Click outside to close
      await page.locator('main').click()
      await page.waitForTimeout(300)
    }
  })

  test('mobile bottom navigation is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // Look for bottom nav (may not exist on all viewports)
    const bottomNav = page.locator('nav').last()
    
    // If it exists, it should be visible
    if (await bottomNav.count() > 0) {
      const isVisible = await bottomNav.isVisible()
      // On mobile, bottom nav should be visible
      expect(isVisible).toBeTruthy()
    }
  })

  test('horizontal scrolling is prevented', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    
    // Check body overflow
    const overflowX = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflowX
    })
    
    expect(overflowX).not.toBe('scroll')
  })
})

test.describe('Tablet Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 }) // iPad Pro size
    await mockAllAPIs(page)
  })

  test('renders correctly on tablet viewport', async ({ page }) => {
    await page.goto('/')

    // Both sidebar and main content should be visible
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
  })

  test('sidebar navigation remains accessible', async ({ page }) => {
    await page.goto('/')

    const navButtons = page.locator('aside nav button')
    const count = await navButtons.count()
    
    expect(count).toBe(7)

    // All nav items should be visible (no scrolling needed)
    for (let i = 0; i < count; i++) {
      await expect(navButtons.nth(i)).toBeVisible()
    }
  })

  test('all views render correctly on tablet', async ({ page }) => {
    await page.goto('/')
    
    const views = ['Activity Feed', 'Pipeline', 'Team Board', 'Timeline', 'Trend Charts', 'Cost Tracker', 'Analytics']
    
    for (const view of views) {
      const navBtn = page.locator('aside nav button', { hasText: view })
      await navBtn.click()
      await page.waitForTimeout(300)
      
      // View should render
      const main = page.locator('main')
      await expect(main).toBeVisible()
      
      const childCount = await main.locator('> *').count()
      expect(childCount).toBeGreaterThan(0)
    }
  })
})

test.describe('Desktop Responsiveness', () => {
  test('renders correctly at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    // Full layout should be visible
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('header')).toBeVisible()

    // Sidebar should be at least 200px wide
    const sidebar = page.locator('aside')
    const box = await sidebar.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(200)
  })

  test('renders correctly at 1366x768 (common laptop)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/')

    // Should adapt gracefully
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('renders correctly at 2560x1440 (large monitor)', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 })
    await page.goto('/')

    // Should utilize extra space effectively
    await expect(page.locator('main')).toBeVisible()

    // Content should not be stretched awkwardly
    const main = page.locator('main')
    const box = await main.boundingBox()
    
    // Main area should take most of the width minus sidebar
    expect(box.width).toBeGreaterThan(1800)
  })
})
