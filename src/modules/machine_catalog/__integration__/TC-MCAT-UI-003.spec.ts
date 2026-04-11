/**
 * TC-MCAT-UI-003: Delete machine catalog profile via edit page
 *
 * Business path: Admin opens an existing profile, clicks delete,
 * confirms, and the profile disappears from the list.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import {
  createMachineProfile,
  createProfileInput,
  listMachineProfiles,
} from './helpers/fixtures'

test.describe('TC-MCAT-UI-003: Delete machine catalog profile', () => {
  test('admin deletes profile and it disappears from list', async ({ page, request }) => {
    const token = getCachedToken()
    let profileId: string | null = null

    try {
      const input = createProfileInput()
      profileId = await createMachineProfile(request, token, input)

      await page.goto(`/backend/machine-catalog/${profileId}`)

      // Wait for form data to load
      await expect(
        page.getByLabel(/rodzina maszyn|machine family/i),
        'Form should load with machineFamily',
      ).toHaveValue(input.machineFamily!, { timeout: 8_000 })

      // Click delete
      await page.getByRole('button', { name: /usuń|delete/i }).click()

      // Confirm dialog if present
      const confirmButton = page.getByRole('button', { name: /potwierdź|confirm|tak|yes/i })
      if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmButton.click()
      }

      // Should redirect to list
      await expect(page).toHaveURL(/\/backend\/machine-catalog(\?.*)?$/, { timeout: 10_000 })

      // Should not appear in list
      await page.getByRole('textbox', { name: /szukaj|search/i }).fill(input.machineFamily!)
      await expect(page.getByText(input.machineFamily!)).not.toBeVisible({ timeout: 5_000 })

      // Verify via API
      const list = await listMachineProfiles(request, token, `ids=${profileId}`)
      expect(list.items.find((item) => item['id'] === profileId)).toBeFalsy()
      profileId = null
    } finally {
      // already deleted — nothing to clean up
    }
  })
})
