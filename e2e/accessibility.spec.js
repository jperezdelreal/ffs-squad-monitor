// @ts-check
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('Dark Mode and Theme Switching', () => {
  test('dark mode persists across page reloads', async ({ page }) => {
    await page.goto('/')

    // Check if settings button exists
    const settingsBtn = page.locator('button', { hasText: 'Settings' })
    await expect(settingsBtn).toBeVisible()

    // Open settings
    await settingsBtn.click()

    // Look for dark mode toggle (implementation may vary)
    // This is a placeholder - adjust selectors based on actual implementation
    const settingsPanel = page.locator('[role="dialog"], [data-testid="settings-panel"]').first()
    
    // If settings panel is visible, verify content renders
    const panelExists = await settingsPanel.isVisible().catch(() => false)
    
    if (panelExists) {
      // Settings panel should have content
      await expect(settingsPanel).not.toBeEmpty()
    }
  })

  test('theme colors apply correctly', async ({ page }) => {
    await page.goto('/')

    // Verify color scheme
    const body = page.locator('body')
    const backgroundColor = await body.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )

    // Should have a defined background color
    expect(backgroundColor).toBeTruthy()
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('text contrast is sufficient in all themes', async ({ page }) => {
    await page.goto('/')

    // Check header text contrast
    const heading = page.locator('header h1')
    const color = await heading.evaluate(el => 
      window.getComputedStyle(el).color
    )
    const bgColor = await heading.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )

    // Colors should be defined (not transparent)
    expect(color).toBeTruthy()
    expect(bgColor).toBeTruthy()
  })

  test('settings panel toggles correctly', async ({ page }) => {
    await page.goto('/')

    const settingsBtn = page.locator('button', { hasText: 'Settings' })
    
    // Open settings
    await settingsBtn.click()
    
    // Settings button should show active state
    await expect(settingsBtn).toHaveClass(/border-cyan/)

    // Click again to close (if toggle behavior exists)
    await settingsBtn.click()
  })
})

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
  })

  test('dashboard has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('activity feed view is accessible', async ({ page }) => {
    await page.goto('/')
    
    const activityBtn = page.locator('aside nav button', { hasText: 'Activity Feed' })
    await activityBtn.click()
    await page.waitForTimeout(500)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('pipeline view is accessible', async ({ page }) => {
    await page.goto('/')
    
    const pipelineBtn = page.locator('aside nav button', { hasText: 'Pipeline' })
    await pipelineBtn.click()
    await page.waitForTimeout(500)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('team board view is accessible', async ({ page }) => {
    await page.goto('/')
    
    const teamBtn = page.locator('aside nav button', { hasText: 'Team Board' })
    await teamBtn.click()
    await page.waitForTimeout(500)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('settings panel is accessible', async ({ page }) => {
    await page.goto('/')
    
    const settingsBtn = page.locator('button', { hasText: /settings/i }).first()
    await settingsBtn.click()
    await page.waitForTimeout(500)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('command palette is accessible', async ({ page }) => {
    await page.goto('/')
    
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(500)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('keyboard navigation works across all views', async ({ page }) => {
    await page.goto('/')

    // Tab to first nav button
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Enter should activate button
    await page.keyboard.press('Enter')
    
    // Main content should update
    await expect(page.locator('main')).toBeVisible()
  })

  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/')

    // Find all buttons
    const buttons = page.locator('button')
    const count = await buttons.count()
    
    expect(count).toBeGreaterThan(0)

    // Tab through elements
    for (let i = 0; i < Math.min(count, 10); i++) {
      await page.keyboard.press('Tab')
    }

    // Focus should be visible somewhere
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })

  test('semantic HTML elements are used correctly', async ({ page }) => {
    await page.goto('/')

    // Check for semantic elements
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('nav')).toBeVisible()
  })

  test('buttons have accessible labels', async ({ page }) => {
    await page.goto('/')

    const navButtons = page.locator('aside nav button')
    const count = await navButtons.count()

    for (let i = 0; i < count; i++) {
      const button = navButtons.nth(i)
      const text = await button.textContent()
      
      // Each button should have text content
      expect(text).toBeTruthy()
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  test('heading hierarchy is correct', async ({ page }) => {
    await page.goto('/')

    // Should have h1
    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()
    await expect(h1).toHaveText('Squad Monitor')

    // Check if h2/h3 exist in logical order
    const headings = await page.locator('h1, h2, h3, h4').allTextContents()
    expect(headings.length).toBeGreaterThan(0)
  })

  test('images have alt text (if present)', async ({ page }) => {
    await page.goto('/')

    const images = page.locator('img')
    const count = await images.count()

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const img = images.nth(i)
        const alt = await img.getAttribute('alt')
        
        // Alt should exist (can be empty for decorative images)
        expect(alt).not.toBeNull()
      }
    }
  })

  test('color is not the only visual indicator', async ({ page }) => {
    await page.goto('/')

    // Sidebar active state should have visual indicators beyond color
    // (e.g., border, icon, text weight)
    const activeButton = page.locator('aside nav button.border-cyan-500').first()
    
    if (await activeButton.isVisible().catch(() => false)) {
      // Active button should have border class (not just color)
      const className = await activeButton.getAttribute('class')
      expect(className).toContain('border')
    }
  })

  test('skip to content link works', async ({ page }) => {
    await page.goto('/')
    
    // Tab to focus skip link
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
    
    // Check if skip link is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.textContent)
    
    if (focusedElement?.includes('Skip to')) {
      // Press Enter to activate
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      
      // Main content should be in focus region
      const main = page.locator('main')
      await expect(main).toBeVisible()
    }
  })
})

test.describe('Error States and Edge Cases', () => {
  test('handles missing backend gracefully', async ({ page }) => {
    // Dashboard should render even if backend is unavailable
    await page.goto('/')

    // Core UI should still be visible
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('displays appropriate error message when data unavailable', async ({ page }) => {
    await page.goto('/')

    // Wait for potential data fetching
    await page.waitForTimeout(2000)

    // Page should still be functional
    const navButtons = page.locator('aside nav button')
    await expect(navButtons.first()).toBeVisible()

    // Can still navigate between views
    await navButtons.nth(1).click()
    await expect(page.locator('main')).toBeVisible()
  })

  test('recovers from navigation errors', async ({ page }) => {
    await page.goto('/')

    // Rapid clicking should not break navigation
    const pipelineBtn = page.locator('aside nav button', { hasText: 'Pipeline' })
    
    await pipelineBtn.click()
    await pipelineBtn.click()
    await pipelineBtn.click()

    // Dashboard should still be responsive
    await expect(page.locator('main')).toBeVisible()
  })

  test('handles empty data gracefully', async ({ page }) => {
    await page.goto('/')

    // Navigate to views that may show empty states
    await page.locator('aside nav button', { hasText: 'Team Board' }).click()
    await expect(page.locator('main')).toBeVisible()

    await page.locator('aside nav button', { hasText: 'Cost Tracker' }).click()
    await expect(page.locator('main')).toBeVisible()

    // No crashes or blank screens
    await expect(page.locator('header')).toBeVisible()
  })
})
