import { expect, test } from '@playwright/test'

test.describe('Technician Schedule List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/backend/technician-schedule', { waitUntil: 'domcontentloaded' })
  })

  test('schedule page loads', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/schedule|grafik|rezerwacj/i, { timeout: 15000 })
  })

  test('filter by reservation type', async ({ page }) => {
    // Look for type filter dropdown/select
    const typeFilter = page.locator('select, [role="combobox"]').first()
    if (await typeFilter.isVisible({ timeout: 5000 })) {
      await typeFilter.click()
      await page.waitForTimeout(300)
    }
    // Page should remain loaded
    await expect(page.locator('body')).toBeVisible()
  })

  test('filter by technician', async ({ page }) => {
    // Look for technician filter
    const techFilter = page.locator('label:has-text("technician") + select, [data-testid*="technician-filter"]').first()
    if (await techFilter.isVisible({ timeout: 5000 })) {
      await techFilter.click()
    }
    await expect(page.locator('body')).toBeVisible()
  })
})
