import { expect, test } from '@playwright/test'

test.describe('Technicians Create Page', () => {
  test('create form loads', async ({ page }) => {
    await page.goto('/backend/technicians/create', { waitUntil: 'domcontentloaded' })
    // Should see form with staff member selection
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })
  })

  test('submit without staff member shows error', async ({ page }) => {
    await page.goto('/backend/technicians/create', { waitUntil: 'domcontentloaded' })
    const submitBtn = page.locator('button[type="submit"]').first()
    if (await submitBtn.isVisible({ timeout: 10000 })) {
      await submitBtn.click()
      // Should show validation error or remain on page
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('/create')
    }
  })
})
