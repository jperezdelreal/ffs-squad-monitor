// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs } from './helpers/mocks.js'

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
  })

  test('auto-dismisses when all health checks pass', async ({ page }) => {
    await page.goto('/')

    // With all APIs mocked (healthy), onboarding should auto-dismiss
    await expect(page.locator('[data-testid="onboarding-dismiss"]')).not.toBeVisible({ timeout: 5000 })

    // Dashboard should be visible
    await expect(page.locator('h1')).toHaveText('Squad Monitor')
    await expect(page.locator('aside nav')).toBeVisible()
  })

  test('dismiss persists across reloads via localStorage', async ({ page }) => {
    await page.goto('/')

    // Wait for auto-dismiss to set localStorage
    await page.waitForFunction(
      () => localStorage.getItem('ffs-onboarding-dismissed') !== null,
      { timeout: 5000 }
    )

    // Reload — no onboarding modal should appear
    await page.reload()
    await expect(page.locator('[data-testid="onboarding-dismiss"]')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('h1')).toHaveText('Squad Monitor')
  })

  test('shows single welcome modal when health checks fail', async ({ page }) => {
    // Override /health to fail
    await page.route('/health', async route => {
      await route.fulfill({ status: 500, body: 'error' })
    })

    await page.goto('/')

    // Single welcome modal with one dismiss button
    const dismissBtn = page.locator('[data-testid="onboarding-dismiss"]')
    await expect(dismissBtn).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Welcome to Squad Monitor')).toBeVisible()

    // Dismiss
    await dismissBtn.click()
    await expect(dismissBtn).not.toBeVisible()

    // localStorage set
    const stored = await page.evaluate(() => localStorage.getItem('ffs-onboarding-dismissed'))
    expect(stored).toBeTruthy()
  })

  test('dismissed modal never shows again on reload', async ({ page }) => {
    // Override /health to fail
    await page.route('/health', async route => {
      await route.fulfill({ status: 500, body: 'error' })
    })

    await page.goto('/')

    // Dismiss the modal
    const dismissBtn = page.locator('[data-testid="onboarding-dismiss"]')
    await expect(dismissBtn).toBeVisible({ timeout: 5000 })
    await dismissBtn.click()

    // Reload — should go straight to dashboard
    await page.reload()
    await expect(page.locator('[data-testid="onboarding-dismiss"]')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('h1')).toHaveText('Squad Monitor')
  })
})
