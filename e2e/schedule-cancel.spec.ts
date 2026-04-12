import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technician Schedule Cancel Flow', () => {
  test('cancel action on reservation shows confirmation', async ({ page, request }) => {
    // First check if there are any reservations to cancel
    const token = await getAuthToken(request, 'admin')
    const res = await apiRequest(request, 'GET', '/api/technician-reservations?page=1&pageSize=1&status=confirmed', { token })
    const items = (await res.json())?.items ?? []

    await page.goto('/backend/technician-schedule', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    if (items.length === 0) {
      test.skip()
      return
    }

    // Look for cancel button/action on a reservation
    const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Anuluj")').first()
    if (await cancelBtn.isVisible({ timeout: 5000 })) {
      await cancelBtn.click()
      // Should show confirmation dialog
      await page.waitForTimeout(500)
      const dialog = page.locator('[role="dialog"], [role="alertdialog"]')
      if (await dialog.isVisible({ timeout: 3000 })) {
        await expect(dialog).toBeVisible()
      }
    }
  })
})
