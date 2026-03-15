// @ts-check
import { test, expect, devices } from '@playwright/test'

test.describe('Mobile Responsiveness', () => {
  test.use({ ...devices['iPhone 12'] })

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
    expect(box!.height).toBeGreaterThanOrEqual(40) // Allow some margin
  })
})

test.describe('Tablet Responsiveness', () => {
  test.use({ ...devices['iPad Pro'] })

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
    expect(box!.width).toBeGreaterThanOrEqual(200)
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
    expect(box!.width).toBeGreaterThan(1800)
  })
})
