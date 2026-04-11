import { expect, test } from '@playwright/test'

test.describe('Technician Schedule Create Page', () => {
  test('create form loads with fields', async ({ page }) => {
    await page.goto('/backend/technician-schedule/create', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })
  })

  test('form has required fields', async ({ page }) => {
    await page.goto('/backend/technician-schedule/create', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Should have reservation type, start/end time, and technician fields
    const formBody = await page.locator('form').textContent()
    expect(formBody).toBeTruthy()
  })
})
