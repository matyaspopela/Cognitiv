import { test, expect } from '@playwright/test'

test.describe('Monochrome Design System Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Design Tokens - Primary colors should be Monochrome (Zinc/Slate)', async ({ page }) => {
    const primaryColor = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement)
      return style.getPropertyValue('--md3-color-primary-500').trim()
    })
    
    // Should be a Zinc shade (e.g., #71717a or rgb(113, 113, 122)) NOT Blue (#60a5fa)
    // Zinc-500 is #71717a
    expect(primaryColor.toLowerCase()).toBe('#71717a') 
  })

  test('Design Tokens - No Secondary (Teal) or Accent (Purple) colors', async ({ page }) => {
     const colors = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement)
      return {
        secondary: style.getPropertyValue('--md3-color-secondary-500').trim(),
        accent: style.getPropertyValue('--md3-color-accent-500').trim()
      }
    })

    // These should ideally be undefined or mapped to monochrome if they exist, 
    // but definitely NOT the old teal/purple values.
    // Old Teal-500: #009688
    // Old Purple-500: #9C27B0
    expect(colors.secondary.toLowerCase()).not.toBe('#009688')
    expect(colors.accent.toLowerCase()).not.toBe('#9c27b0')
  })

  test('Typography - Primary Font should be Inter', async ({ page }) => {
    const fontFamily = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement)
      return style.getPropertyValue('--md3-font-family-primary').trim()
    })
    
    expect(fontFamily).toContain('Inter')
    expect(fontFamily).not.toContain('Space Grotesk')
  })
})
