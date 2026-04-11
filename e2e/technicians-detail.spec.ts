import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technicians Detail Page', () => {
  let technicianId: string | null = null

  test.beforeAll(async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1', { token })
    const items = (await res.json())?.items ?? []
    technicianId = items.length > 0 ? items[0].id : null
  })

  test('detail page shows tabs', async ({ page }) => {
    if (!technicianId) { test.skip(); return }
    await page.goto(`/backend/technicians/${technicianId}/edit`, { waitUntil: 'domcontentloaded' })

    // Should see tab buttons
    await expect(page.getByRole('button', { name: /profile/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /skills/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /certif/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /availab/i })).toBeVisible()
  })

  test('certifications tab displays list', async ({ page }) => {
    if (!technicianId) { test.skip(); return }
    await page.goto(`/backend/technicians/${technicianId}/edit`, { waitUntil: 'domcontentloaded' })

    const certsTab = page.getByRole('button', { name: /certif/i })
    await certsTab.click()
    await page.waitForTimeout(500)
    // Should see add certification button
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible({ timeout: 5000 })
  })

  test('availability tab shows calendar', async ({ page }) => {
    if (!technicianId) { test.skip(); return }
    await page.goto(`/backend/technicians/${technicianId}/edit`, { waitUntil: 'domcontentloaded' })

    const availTab = page.getByRole('button', { name: /availab/i })
    await availTab.click()
    await page.waitForTimeout(500)
    // Calendar grid should be visible (7-column grid with weekday headers)
    await expect(page.locator('text=Mon').first()).toBeVisible({ timeout: 5000 })
  })
})
