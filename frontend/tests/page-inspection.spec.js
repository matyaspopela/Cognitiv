import { test, expect } from '@playwright/test'

test.describe('Page Inspection - localhost:8000', () => {
  test('Inspect Connect page structure and firmware upload', async ({ page }) => {
    await page.goto('http://localhost:8000/connect')
    await page.waitForLoadState('networkidle')
    
    // Take screenshot
    await page.screenshot({ path: 'connect-page-inspection.png', fullPage: true })
    
    // Check for key elements
    const title = page.locator('h1, h2').first()
    const form = page.locator('form')
    const boardNameInput = page.locator('input[placeholder*="desky"], input[placeholder*="board"], input[name*="board"], input[label*="board"]')
    const ssidInput = page.locator('input[placeholder*="SSID"], input[name*="ssid"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button[type="submit"], button:has-text("Nahrát"), button:has-text("Upload")')
    
    // Log page structure
    const pageContent = await page.content()
    console.log('Page title:', await title.textContent().catch(() => 'Not found'))
    console.log('Form found:', await form.count() > 0)
    console.log('Board name input found:', await boardNameInput.count() > 0)
    console.log('SSID input found:', await ssidInput.count() > 0)
    console.log('Password input found:', await passwordInput.count() > 0)
    console.log('Submit button found:', await submitButton.count() > 0)
    
    // Check for documentation-style elements
    const tips = page.locator('[class*="tip"], [class*="info"], [class*="help"]')
    const descriptions = page.locator('p, [class*="description"], [class*="info-card"]')
    
    console.log('Tips/info sections found:', await tips.count())
    console.log('Description paragraphs found:', await descriptions.count())
    
    // Get computed styles for key elements
    const bodyStyles = await page.evaluate(() => {
      const body = document.body
      return {
        backgroundColor: window.getComputedStyle(body).backgroundColor,
        color: window.getComputedStyle(body).color,
        fontFamily: window.getComputedStyle(body).fontFamily,
      }
    })
    
    console.log('Body styles:', bodyStyles)
    
    // Check if it looks tool-like or doc-like
    const hasLargeInfoSections = await tips.count() > 3
    const hasLongDescriptions = (await descriptions.count()) > 5
    
    console.log('Assessment:')
    console.log('- Has large info sections:', hasLargeInfoSections)
    console.log('- Has long descriptions:', hasLongDescriptions)
    console.log('- Looks like documentation:', hasLargeInfoSections || hasLongDescriptions)
  })
  
  test('Inspect all main pages', async ({ page }) => {
    const routes = ['/', '/dashboard', '/admin', '/connect', '/login']
    
    for (const route of routes) {
      try {
        await page.goto(`http://localhost:8000${route}`)
        await page.waitForLoadState('networkidle', { timeout: 10000 })
        await page.waitForTimeout(1000)
        
        const screenshotName = route === '/' ? 'home' : route.slice(1)
        await page.screenshot({ 
          path: `inspection-${screenshotName}.png`, 
          fullPage: true 
        })
        
        console.log(`✓ Screenshot saved for ${route}: inspection-${screenshotName}.png`)
      } catch (error) {
        console.error(`✗ Failed to inspect ${route}:`, error.message)
      }
    }
  })
})




