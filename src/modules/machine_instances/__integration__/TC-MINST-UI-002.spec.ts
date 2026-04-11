/**
 * TC-MINST-UI-002: Edit machine instance via form
 *
 * Business path: Admin opens an existing machine instance from the list,
 * changes the site name and warranty status, saves, and verifies the
 * changes are reflected in the list.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import {
  createMachineInstance,
  createMachineInstanceInput,
  deleteMachineInstance,
  listMachineInstances,
} from './helpers/fixtures'

test.describe('TC-MINST-UI-002: Edit machine instance via form', () => {
  test('admin edits machine instance and changes persist in list', async ({ page, request }) => {
    const token = getCachedToken()
    let instanceId: string | null = null
    const updatedSite = 'QA E2E Zaktualizowana Lokalizacja'

    try {
      const input = createMachineInstanceInput({ siteName: 'QA Stara Lokalizacja' })
      instanceId = await createMachineInstance(request, token, input)

      await page.goto(`/backend/machine-instances/${instanceId}`)

      // Wait for form to load data
      await expect(page.getByLabel(/kod egzemplarza|instance code/i)).toHaveValue(input.instanceCode, { timeout: 8_000 })

      // Update site name
      const siteNameField = page.getByLabel(/nazwa lokalizacji|site name/i)
      await siteNameField.clear()
      await siteNameField.fill(updatedSite)

      // Set warranty status
      await page.getByLabel(/status gwarancji|warranty status/i).selectOption('active')

      // Save
      await page.getByRole('button', { name: /zapisz|save/i }).click()

      // Should redirect to list
      await expect(page).toHaveURL(/\/backend\/machine-instances(\?.*)?$/, { timeout: 10_000 })

      // Verify changes in list
      await page.getByRole('textbox', { name: /szukaj|search/i }).fill(input.instanceCode)
      await expect(page.getByText(input.instanceCode)).toBeVisible({ timeout: 8_000 })

      // Verify via API
      const list = await listMachineInstances(request, token, `ids=${instanceId}`)
      const updated = list.items.find((item) => item['id'] === instanceId)
      expect(updated?.['siteName']).toBe(updatedSite)
      expect(updated?.['warrantyStatus']).toBe('active')
    } finally {
      if (instanceId) await deleteMachineInstance(request, token, instanceId)
    }
  })
})
