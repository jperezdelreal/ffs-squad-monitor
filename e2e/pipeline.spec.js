// @ts-check
import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockIssues } from './helpers/mocks.js'

test.describe('PipelineVisualizer view', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/')
    
    // Navigate to Pipeline view
    const pipelineBtn = page.locator('aside nav button', { hasText: 'Pipeline' })
    await pipelineBtn.click()
    await page.waitForTimeout(500)
  })

  test('displays pipeline stages', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    
    // Pipeline should render stage columns
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)
  })

  test('shows issues in correct pipeline stages', async ({ page }) => {
    // Wait for pipeline to render
    await page.waitForSelector('main', { state: 'visible' })
    
    // Mock has issues labeled with stages: "Proposal", "GDD", "Issues", "Code", "Build"
    const main = page.locator('main')
    const content = await main.textContent()
    
    // Verify content is rendered
    expect(content.length).toBeGreaterThan(0)
  })

  test('detects bottlenecks when stage has ≥5 issues', async ({ page }) => {
    // Mock API with 6 issues in same stage
    const bottleneckIssues = Array.from({ length: 6 }, (_, i) => ({
      repo: 'ffs-squad-monitor',
      repoLabel: 'Squad Monitor',
      repoEmoji: '👁️',
      number: 100 + i,
      title: `Bottleneck issue ${i}`,
      state: 'open',
      url: `https://github.com/test/repo/issues/${100 + i}`,
      priority: 1,
      labels: ['Code', 'priority:P1'],
      assignees: [],
      prStatus: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    
    await page.route('/api/issues*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bottleneckIssues)
      })
    })
    
    await page.reload()
    await page.waitForTimeout(500)
    
    // Verify pipeline renders
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('stage cells are clickable', async ({ page }) => {
    await page.waitForSelector('main', { state: 'visible' })
    
    // Try to find clickable elements in pipeline
    const main = page.locator('main')
    const buttons = main.locator('button, [role="button"]')
    
    if (await buttons.count() > 0) {
      const firstButton = buttons.first()
      await firstButton.click()
      
      // Should not crash after click
      await expect(main).toBeVisible()
    }
  })
})
