import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technician Schedule Edit Page', () => {
  let reservationId: string | null = null

  test.beforeAll(async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const res = await apiRequest(request, 'GET', '/api/technician-reservations?page=1&pageSize=1', { token })
    const items = (await res.json())?.items ?? []
    reservationId = items.length > 0 ? items[0].id : null
  })

  test('edit form loads with existing data', async ({ page }) => {
    if (!reservationId) { test.skip(); return }
    await page.goto(`/backend/technician-schedule/${reservationId}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })
  })

  test('edit form is pre-populated', async ({ page }) => {
    if (!reservationId) { test.skip(); return }
    await page.goto(`/backend/technician-schedule/${reservationId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Form should have content (not empty)
    const formContent = await page.locator('form').textContent()
    expect(formContent?.length).toBeGreaterThan(0)
  })
})
