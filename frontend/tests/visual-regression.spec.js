import { test, expect } from '@playwright/test'

const routes = [
  { path: '/', name: 'home' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/admin', name: 'admin' },
  { path: '/connect', name: 'connect' },
  { path: '/login', name: 'login' },
]

const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 667, name: 'mobile' },
]

test.describe('Visual Regression Tests', () => {
  for (const route of routes) {
    for (const viewport of viewports) {
      test(`${route.name} page - ${viewport.name} viewport`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(route.path)
        await page.waitForLoadState('networkidle')
        
        // Wait for any animations to complete
        await page.waitForTimeout(500)
        
        // Take full page screenshot
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixels: 100,
        })
      })
    }
  }

  test('Component Screenshots - Sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toHaveScreenshot('component-sidebar.png', {
      maxDiffPixels: 50,
    })
  })

  test('Component Screenshots - TopHeader', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const header = page.locator('.top-header').first()
    await expect(header).toHaveScreenshot('component-top-header.png', {
      maxDiffPixels: 50,
    })
  })

  test('Component Screenshots - MetricCard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const metricCard = page.locator('.metric-card').first()
    if (await metricCard.count() > 0) {
      await expect(metricCard).toHaveScreenshot('component-metric-card.png', {
        maxDiffPixels: 50,
      })
    }
  })

  test('Dark Mode Verification', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const body = page.locator('body')
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // Verify dark background
    expect(bgColor).toContain('rgb(9, 9, 11)')
    
    // Take screenshot for dark mode verification
    await expect(page).toHaveScreenshot('dark-mode-verification.png', {
      fullPage: true,
      maxDiffPixels: 100,
    })
  })
})






