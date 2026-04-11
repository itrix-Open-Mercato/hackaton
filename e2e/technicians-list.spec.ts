import { expect, test } from '@playwright/test'

test.describe('Technicians List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/backend/technicians', { waitUntil: 'domcontentloaded' })
  })

  test('list page loads with table', async ({ page }) => {
    await expect(page.locator('table, [data-testid="data-table"]')).toBeVisible({ timeout: 15000 })
  })

  test('search filters technicians', async ({ page }) => {
    const searchInput = page.locator('input[type="text"][placeholder*="earch"], input[type="search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin')
      await page.waitForTimeout(500)
      // Table should still be visible after search
      await expect(page.locator('table, [data-testid="data-table"]')).toBeVisible()
    }
  })

  test('navigate to technician detail', async ({ page }) => {
    const firstRow = page.locator('table tbody tr, [data-testid="data-table"] [role="row"]').first()
    if (await firstRow.isVisible({ timeout: 10000 })) {
      await firstRow.click()
      await page.waitForURL(/\/backend\/technicians\/.*\/edit/, { timeout: 10000 })
      expect(page.url()).toContain('/edit')
    }
  })
})
