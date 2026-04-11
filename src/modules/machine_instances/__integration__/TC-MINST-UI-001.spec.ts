/**
 * TC-MINST-UI-001: Create machine instance via form
 *
 * Business path: Admin navigates to the machine instances list,
 * clicks "Nowa maszyna", fills the form, submits, and sees the
 * new record appear in the list.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { deleteMachineInstance, listMachineInstances } from './helpers/fixtures'

function uniqueCode(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

test.describe('TC-MINST-UI-001: Create machine instance via form', () => {
  test('admin fills form and sees new record in list', async ({ page, request }) => {
    const token = getCachedToken()
    let instanceId: string | null = null
    const instanceCode = uniqueCode('UI-MI')
    const siteName = 'QA E2E Fabryka'

    try {
      // Navigate to list and click create
      await page.goto('/backend/machine-instances')
      await expect(page.getByRole('table')).toBeVisible()
      await page.getByRole('link', { name: /nowa maszyna|new machine/i }).click()
      await expect(page).toHaveURL(/\/backend\/machine-instances\/create/)

      // Fill required field: Instance Code
      await page.getByLabel(/kod egzemplarza|instance code/i).fill(instanceCode)

      // Fill optional fields
      await page.getByLabel(/numer seryjny|serial number/i).fill('SN-E2E-001')
      await page.getByLabel(/nazwa lokalizacji|site name/i).fill(siteName)
      await page.getByLabel(/osoba kontaktowa|contact name/i).fill('Jan Kowalski')

      // Submit
      await page.getByRole('button', { name: /utwórz|create/i }).click()

      // Should redirect to list
      await expect(page).toHaveURL(/\/backend\/machine-instances(\?.*)?$/, { timeout: 10_000 })

      // Record should appear in list
      await page.getByRole('textbox', { name: /szukaj|search/i }).fill(instanceCode)
      await expect(page.getByText(instanceCode)).toBeVisible({ timeout: 8_000 })

      // Capture ID for cleanup
      const list = await listMachineInstances(request, token, `search=${encodeURIComponent(instanceCode)}`)
      instanceId = (list.items[0]?.['id'] as string) ?? null
    } finally {
      if (instanceId) await deleteMachineInstance(request, token, instanceId)
    }
  })

  test('required field validation prevents empty submission', async ({ page }) => {
    await page.goto('/backend/machine-instances/create')

    // Try to submit without filling required instanceCode
    await page.getByRole('button', { name: /utwórz|create/i }).click()

    // Should still be on create page (not redirected)
    await expect(page).toHaveURL(/\/backend\/machine-instances\/create/)
  })
})
