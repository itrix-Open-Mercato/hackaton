/**
 * TC-MINST-UI-003: Delete machine instance via edit page
 *
 * Business path: Admin opens an existing machine, clicks delete,
 * confirms in the dialog, and the record disappears from the list.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import {
  createMachineInstance,
  createMachineInstanceInput,
  listMachineInstances,
} from './helpers/fixtures'

test.describe('TC-MINST-UI-003: Delete machine instance', () => {
  test('admin deletes machine instance and it disappears from list', async ({ page, request }) => {
    const token = getCachedToken()
    let instanceId: string | null = null

    try {
      const input = createMachineInstanceInput()
      instanceId = await createMachineInstance(request, token, input)

      await page.goto(`/backend/machine-instances/${instanceId}`)

      // Wait for form to load
      await expect(page.getByLabel(/kod egzemplarza|instance code/i)).toHaveValue(input.instanceCode, { timeout: 8_000 })

      // Click delete button — CrudForm renders a delete button
      await page.getByRole('button', { name: /usuń|delete/i }).click()

      // Confirm in dialog if one appears
      const confirmButton = page.getByRole('button', { name: /potwierdź|confirm|tak|yes/i })
      if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmButton.click()
      }

      // Should redirect to list
      await expect(page).toHaveURL(/\/backend\/machine-instances(\?.*)?$/, { timeout: 10_000 })

      // Record should no longer appear
      await page.getByRole('textbox', { name: /szukaj|search/i }).fill(input.instanceCode)
      await expect(page.getByText(input.instanceCode)).not.toBeVisible({ timeout: 5_000 })

      // Verify via API
      const list = await listMachineInstances(request, token, `search=${encodeURIComponent(input.instanceCode)}`)
      expect(list.items.find((item) => item['id'] === instanceId)).toBeFalsy()
      instanceId = null // already deleted
    } finally {
      // No cleanup needed — deleted in test
    }
  })
})
