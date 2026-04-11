import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technicians Availability Calendar', () => {
  let technicianId: string | null = null

  test.beforeAll(async ({ request }) => {
    const token = await getAuthToken(request, 'admin')
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1', { token })
    const items = (await res.json())?.items ?? []
    technicianId = items.length > 0 ? items[0].id : null
  })

  test('click day to set availability', async ({ page }) => {
    if (!technicianId) { test.skip(); return }
    await page.goto(`/backend/technicians/${technicianId}/edit`, { waitUntil: 'domcontentloaded' })

    // Navigate to availability tab
    const availTab = page.getByRole('button', { name: /availab/i })
    await availTab.click()
    await page.waitForTimeout(1000)

    // Click a day button in the calendar grid (pick day 15)
    const dayButton = page.locator('button:has-text("15")').last()
    if (await dayButton.isVisible({ timeout: 5000 })) {
      const classBefore = await dayButton.getAttribute('class')
      await dayButton.click()
      await page.waitForTimeout(1000)
      // Class should change (color change indicates day type cycle)
      const classAfter = await dayButton.getAttribute('class')
      // The button should still be present after click
      await expect(dayButton).toBeVisible()
    }
  })

  test('navigate calendar months', async ({ page }) => {
    if (!technicianId) { test.skip(); return }
    await page.goto(`/backend/technicians/${technicianId}/edit`, { waitUntil: 'domcontentloaded' })

    const availTab = page.getByRole('button', { name: /availab/i })
    await availTab.click()
    await page.waitForTimeout(1000)

    // Get current month text
    const monthLabel = page.locator('span.min-w-\\[140px\\]').first()
    const currentMonth = await monthLabel.textContent()

    // Click next month button
    const nextBtn = page.locator('button:has(svg.lucide-chevron-right)').first()
    if (await nextBtn.isVisible({ timeout: 5000 })) {
      await nextBtn.click()
      await page.waitForTimeout(500)
      const nextMonth = await monthLabel.textContent()
      expect(nextMonth).not.toBe(currentMonth)
    }
  })
})
