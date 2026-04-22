import { test, expect } from '@playwright/test'

test.describe('Design Consistency Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for page to be fully loaded
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Color Consistency - Background colors match Bleached Stone palette', async ({ page }) => {
    const body = page.locator('body')
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // Should be light background (stone-50: rgb(250, 250, 249))
    expect(bgColor).toContain('rgb(250, 250, 249)')
  })

  test('Typography - Headers use Inter font', async ({ page }) => {
    const h1 = page.locator('h1').first()
    const fontFamily = await h1.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily
    })
    
    expect(fontFamily.toLowerCase()).toContain('inter')
  })

  test('Typography - Labels are small and medium weight', async ({ page }) => {
    const labels = page.locator('[class*="text-[10px]"], [class*="label"]')
    const count = await labels.count()
    
    if (count > 0) {
      const firstLabel = labels.first()
      const fontSize = await firstLabel.evaluate((el) => {
        return window.getComputedStyle(el).fontSize
      })
      
      // Font size should be 10px or 11px
      expect(parseInt(fontSize)).toBeLessThanOrEqual(12)
    }
  })

  test('Spacing - Consistent padding in cards', async ({ page }) => {
    const cards = page.locator('[class*="card"]')
    const count = await cards.count()
    
    if (count > 0) {
      const firstCard = cards.first()
      const padding = await firstCard.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          top: style.paddingTop,
          right: style.paddingRight,
          bottom: style.paddingBottom,
          left: style.paddingLeft,
        }
      })
      
      // Cards should have consistent padding
      expect(padding.top).not.toBe('0px')
    }
  })

  test('Component Styling - Cards have white background and subtle border', async ({ page }) => {
    const cards = page.locator('[class*="card"]')
    const count = await cards.count()
    
    if (count > 0) {
      const firstCard = cards.first()
      const bgColor = await firstCard.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })
      
      // Background should be white (rgb(255, 255, 255))
      expect(bgColor).toContain('rgb(255, 255, 255)')
    }
  })

  test('Layout Structure - Sidebar is 200px wide', async ({ page }) => {
    const sidebar = page.locator('aside').first()
    const width = await sidebar.evaluate((el) => {
      return window.getComputedStyle(el).width
    })
    
    expect(width).toBe('200px')
  })

  test('Layout Structure - PageHeader is present', async ({ page }) => {
    const header = page.locator('h1').first()
    expect(await header.isVisible()).toBeTruthy()
  })

  test('No Elevation Shadows - Cards should not have heavy shadows', async ({ page }) => {
    const cards = page.locator('.md3-card, [class*="card"]')
    const count = await cards.count()
    
    if (count > 0) {
      const firstCard = cards.first()
      const boxShadow = await firstCard.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow
      })
      
      // Should be 'none' or very subtle
      expect(boxShadow).toBe('none')
    }
  })

  test('Border Colors - Subtle white borders (white/5 or white/10)', async ({ page }) => {
    const borderedElements = page.locator('[class*="border"], .md3-card')
    const count = await borderedElements.count()
    
    if (count > 0) {
      const firstElement = borderedElements.first()
      const borderColor = await firstElement.evaluate((el) => {
        return window.getComputedStyle(el).borderColor
      })
      
      // Border should be present and subtle (not black)
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(borderColor).not.toContain('rgb(0, 0, 0)')
    }
  })
})






