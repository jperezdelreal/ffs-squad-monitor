import { test, expect } from '@playwright/test'
import { mockAllAPIs, mockConfig, mockIssues, mockUsage, mockEvents } from './helpers/mocks.js'

// Agent data matching /api/agents response shape
const mockAgents = [
  { id: 'ripley', emoji: '🦁', role: 'Lead', color: '#ff6b6b', status: 'working', lastActivity: new Date().toISOString(), currentWork: 'Sprint planning' },
  { id: 'dallas', emoji: '🎨', role: 'Frontend Dev', color: '#51cf66', status: 'idle', lastActivity: null, currentWork: null },
  { id: 'lambert', emoji: '⚙️', role: 'Backend Dev', color: '#339af0', status: 'working', lastActivity: new Date().toISOString(), currentWork: 'API refactor' },
  { id: 'kane', emoji: '🧪', role: 'Tester', color: '#ffa94d', status: 'working', lastActivity: new Date().toISOString(), currentWork: 'E2E tests' },
]

async function clickNavItem(page, label) {
  const btn = page.locator('aside nav button', { hasText: label })
  await btn.waitFor({ state: 'attached', timeout: 5000 })
  // Framer Motion uses inline transforms — use JS click to bypass Playwright actionability checks
  // Dispatch a proper mouse event that React recognizes
  await btn.dispatchEvent('click')
  return btn
}

async function setupMocksWithAgents(page) {
  await mockAllAPIs(page)
  await page.route('/api/agents', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAgents),
    })
  })
}

async function dismissOnboardingIfVisible(page) {
  const dismiss = page.getByTestId('onboarding-dismiss')
  if (await dismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dismiss.evaluate(el => el.click())
    await dismiss.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  }
  // Also dismiss setup checklist if it appears
  const setupBtn = page.getByRole('button', { name: /all set|continue/i })
  if (await setupBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await setupBtn.evaluate(el => el.click())
    await setupBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  }
}

test.describe('Data Quality E2E Tests', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test.beforeEach(async ({ page }) => {
    // Clear onboarding state so it doesn't interfere with non-onboarding tests
    await page.addInitScript(() => {
      localStorage.setItem('ffs-onboarding-dismissed', new Date().toISOString())
    })
  })

  test('1. API-to-UI consistency — TeamBoard shows same agents as /api/agents', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    await clickNavItem(page, 'Team Board')

    // Wait for Team Board-specific content (role text only appears in Team Board, not Activity Feed)
    const main = page.locator('main')
    await expect(main.locator('text=Workload Distribution')).toBeVisible({ timeout: 10000 })

    const mainText = await main.textContent()

    // Verify all 4 agent names from mockConfig appear in TeamBoard
    const agentNames = Object.keys(mockConfig.agents)
    expect(agentNames).toHaveLength(4)
    for (const name of agentNames) {
      expect(mainText.toLowerCase()).toContain(name)
    }

    // Verify agent roles appear
    for (const agent of Object.values(mockConfig.agents)) {
      expect(mainText).toContain(agent.role)
    }
  })

  test('2. Issue count match — Pipeline shows matching issue count from /api/issues', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    await clickNavItem(page, 'Pipeline')

    const main = page.locator('main')
    // Wait for Pipeline to render its table structure
    await expect(main.locator('table').first()).toBeVisible({ timeout: 10000 })

    const mainText = await main.textContent()

    // Pipeline renders a table with repos as rows and stages as columns
    // Verify the repo name from mock issues appears in the pipeline
    const uniqueRepos = [...new Set(mockIssues.map(i => i.repo))]
    for (const repo of uniqueRepos) {
      expect(mainText).toContain(repo)
    }

    // Verify pipeline stage headers are rendered (data-driven table structure)
    const stageNames = ['Proposal', 'GDD', 'Issues', 'Code', 'Build', 'Deploy']
    for (const stage of stageNames) {
      expect(mainText).toContain(stage)
    }

    // Verify the pipeline shows tracked repository count matching unique repos
    expect(mainText).toContain(`${uniqueRepos.length} repositor`)
  })

  test('3. Cost data present — CostTracker shows real numbers, not dashes', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    await clickNavItem(page, 'Cost Tracker')
    await page.waitForTimeout(1000)

    const main = page.locator('main')
    const mainText = await main.textContent()

    // mockUsage: totalMinutesUsed=1850, includedMinutes=2000, percentage=92.5
    // Verify actual numbers appear (not just dashes or placeholders)
    expect(mainText).toContain('1850')
    expect(mainText).toMatch(/92\.5/)

    // Verify progress bar has a width > 0 (data is rendered, not empty)
    const progressBar = main.locator('[style*="width"]').first()
    if (await progressBar.isVisible().catch(() => false)) {
      const style = await progressBar.getAttribute('style')
      expect(style).toMatch(/width:\s*\d/)
    }

    // Should not contain only dashes/placeholders for the main metric
    const dashOnlyPattern = /^[\s—–-]+$/
    expect(dashOnlyPattern.test(mainText)).toBeFalsy()
  })

  test('4. Agent status not all idle — UI reflects active agents from API', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    await clickNavItem(page, 'Team Board')

    const main = page.locator('main')
    await expect(main.locator('text=Workload Distribution')).toBeVisible({ timeout: 10000 })

    const mainText = await main.textContent()

    // mockAgents has 3 working agents (ripley, lambert, kane) and 1 idle (dallas)
    // Verify not everything shows as idle
    const idleCount = (mainText.match(/Idle/g) || []).length
    const totalAgents = Object.keys(mockConfig.agents).length

    // At least some agents should NOT be idle
    // (We have 3 working + 1 idle in our mock, so idle count < total)
    expect(idleCount).toBeLessThan(totalAgents)
  })

  test('5. Light mode renders — toggle theme without errors, take screenshot', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    // Start in dark mode (default)
    const themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/i })
    await expect(themeToggle).toBeVisible()

    // Toggle to light mode
    await themeToggle.evaluate(el => el.click())
    await page.waitForTimeout(500)

    // Verify no error boundary fired (💥 "Something went wrong" should not appear)
    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).toHaveCount(0)

    // Verify the page still has content (didn't crash)
    const main = page.locator('main')
    await expect(main).toBeVisible()
    const childCount = await main.locator('> *').count()
    expect(childCount).toBeGreaterThan(0)

    // Take screenshot for visual verification
    await page.screenshot({ path: 'e2e/screenshots/data-quality-light-mode.png' })

    // Verify theme persistence in localStorage
    const storedTheme = await page.evaluate(() => localStorage.getItem('ffs-squad-monitor-theme'))
    expect(storedTheme).toBe('light')
  })

  test('6. No heartbeat in header — header does NOT contain "Deps" or heartbeat indicator', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    const header = page.locator('header')
    await expect(header).toBeVisible()
    const headerText = await header.textContent()

    // Verify header does NOT contain "Deps" or heartbeat-specific text
    expect(headerText).not.toContain('Deps')

    // Header should contain expected items (Squad Monitor title)
    expect(headerText).toContain('Squad Monitor')
  })

  test('7. Charts render data — Trend Charts view has canvas with drawn content', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    await clickNavItem(page, 'Trend Charts')
    await page.waitForTimeout(2000)

    const main = page.locator('main')

    // Chart.js renders to <canvas> elements
    const canvases = main.locator('canvas')
    const canvasCount = await canvases.count()
    expect(canvasCount).toBeGreaterThan(0)

    // Verify at least one canvas has been drawn to (non-blank)
    for (let i = 0; i < Math.min(canvasCount, 3); i++) {
      const canvas = canvases.nth(i)
      const hasContent = await canvas.evaluate(el => {
        const ctx = el.getContext('2d')
        if (!ctx) return false
        // Check if the canvas has any non-transparent pixels
        const imageData = ctx.getImageData(0, 0, el.width, el.height)
        return imageData.data.some(val => val !== 0)
      })
      expect(hasContent).toBeTruthy()
    }
  })

  test('8. Navigation data isolation — each view shows its own data', async ({ page }) => {
    await setupMocksWithAgents(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    // Default view is Activity Feed — wait for it to render
    const main = page.locator('main')
    await expect(main.locator('text=Activity').first()).toBeVisible({ timeout: 10000 })
    const activityContent = await main.textContent()

    // Navigate to Team Board — wait for Team Board-specific content
    await clickNavItem(page, 'Team Board')
    await expect(main.locator('text=Workload Distribution')).toBeVisible({ timeout: 10000 })
    const teamContent = await main.textContent()

    // Navigate to Cost Tracker — wait for Cost Tracker-specific content
    await clickNavItem(page, 'Cost Tracker')
    await expect(main.locator('text=GITHUB ACTIONS').first()).toBeVisible({ timeout: 10000 })
    const costContent = await main.textContent()

    // Verify each view has different content (data isolation)
    expect(teamContent).not.toBe(costContent)
    expect(activityContent).not.toBe(costContent)

    // Team Board should contain agent-specific data
    expect(teamContent).toContain('Workload Distribution')
    expect(teamContent.toLowerCase()).toContain('ripley')

    // Cost Tracker should contain usage-specific data
    expect(costContent).toContain('1850')
    expect(costContent).toMatch(/usage|minutes|actions|free tier/i)
  })

  test('9. Error handling — failed API renders error state, not crash', async ({ page }) => {
    await setupMocksWithAgents(page)

    // Override /api/events to return 500 error
    await page.unroute('/api/events')
    await page.route('/api/events', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await dismissOnboardingIfVisible(page)

    // Activity Feed is the default view — it should show error state, not crash
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Should NOT show ErrorBoundary crash (💥 "Something went wrong")
    const crashIndicator = page.locator('text=Something went wrong')
    await expect(crashIndicator).toHaveCount(0)

    // Page should still be functional — verify sidebar is still navigable
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeAttached()

    // Should be able to navigate to a working view
    await clickNavItem(page, 'Cost Tracker')
    await page.waitForTimeout(1000)
    const costText = await main.textContent()
    expect(costText).toContain('1850')
  })

  test('10. Onboarding dismissal — dismiss persists across reload', async ({ context, page: _ }) => {
    // Use a fresh page without the beforeEach addInitScript (which sets dismissed key)
    const page = await context.newPage()

    // Ensure onboarding is NOT dismissed initially
    await page.addInitScript(() => {
      localStorage.removeItem('ffs-onboarding-dismissed')
    })

    await setupMocksWithAgents(page)

    // Make one health check fail so WelcomeModal shows
    await page.route('/health', async route => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Welcome modal should appear (health check failed)
    const dismissBtn = page.getByTestId('onboarding-dismiss')
    await expect(dismissBtn).toBeVisible({ timeout: 5000 })

    // Dismiss the onboarding
    await dismissBtn.evaluate(el => el.click())
    await dismissBtn.waitFor({ state: 'hidden', timeout: 5000 })

    // Verify localStorage was set
    const stored = await page.evaluate(() => localStorage.getItem('ffs-onboarding-dismissed'))
    expect(stored).toBeTruthy()

    // Create another fresh page in the same context (shares localStorage)
    // but WITHOUT the removeItem init script
    const page2 = await context.newPage()
    await setupMocksWithAgents(page2)
    await page2.route('/health', async route => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    })
    await page2.goto('/')
    await page2.waitForLoadState('networkidle')

    // WelcomeModal should NOT be visible — dismissal persisted via localStorage
    const welcomeText = page2.locator('text=Welcome to Squad Monitor')
    await expect(welcomeText).toHaveCount(0)

    // Dashboard should render normally
    const main = page2.locator('main')
    await expect(main).toBeVisible()

    await page2.close()
    await page.close()
  })
})
