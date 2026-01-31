import { test, expect } from '@playwright/test'

test.describe('Design Consistency Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for page to be fully loaded
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Color Consistency - Background colors match Linear palette', async ({ page }) => {
    const body = page.locator('body')
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // Should be dark background (zinc-950: rgb(9, 9, 11))
    expect(bgColor).toContain('rgb(9, 9, 11)')
  })

  test('Typography - Headers use Inter font', async ({ page }) => {
    const h1 = page.locator('h1').first()
    const fontFamily = await h1.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily
    })
    
    expect(fontFamily.toLowerCase()).toContain('inter')
  })

  test('Typography - Labels are uppercase and small', async ({ page }) => {
    const labels = page.locator('.text-label-kicker, [class*="label"]')
    const count = await labels.count()
    
    if (count > 0) {
      const firstLabel = labels.first()
      const fontSize = await firstLabel.evaluate((el) => {
        return window.getComputedStyle(el).fontSize
      })
      const textTransform = await firstLabel.evaluate((el) => {
        return window.getComputedStyle(el).textTransform
      })
      
      // Font size should be 11px (0.6875rem)
      expect(fontSize).toBe('11px')
      // Should be uppercase
      expect(textTransform).toBe('uppercase')
    }
  })

  test('Spacing - Consistent padding in cards', async ({ page }) => {
    const cards = page.locator('.md3-card, [class*="card"]')
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
      
      // Cards should have consistent padding (typically 24px or 16px)
      const paddingValues = [padding.top, padding.right, padding.bottom, padding.left]
      const hasConsistentPadding = paddingValues.every(
        (val) => val === '24px' || val === '16px' || val === '1.5rem' || val === '1rem'
      )
      expect(hasConsistentPadding).toBeTruthy()
    }
  })

  test('Component Styling - Cards have dark background and subtle border', async ({ page }) => {
    const cards = page.locator('.md3-card, [class*="card"]')
    const count = await cards.count()
    
    if (count > 0) {
      const firstCard = cards.first()
      const bgColor = await firstCard.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })
      const borderColor = await firstCard.evaluate((el) => {
        return window.getComputedStyle(el).borderColor
      })
      
      // Background should be dark (zinc-900/50: rgba(24, 24, 27, 0.5))
      expect(bgColor).toContain('rgb(24, 24, 27)')
      // Border should exist
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)')
    }
  })

  test('Layout Structure - Sidebar is 240px wide', async ({ page }) => {
    const sidebar = page.locator('aside').first()
    const width = await sidebar.evaluate((el) => {
      return window.getComputedStyle(el).width
    })
    
    expect(width).toBe('240px')
  })

  test('Layout Structure - TopHeader is sticky', async ({ page }) => {
    const header = page.locator('.top-header, [class*="top-header"]').first()
    const position = await header.evaluate((el) => {
      return window.getComputedStyle(el).position
    })
    
    expect(position).toBe('sticky')
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






