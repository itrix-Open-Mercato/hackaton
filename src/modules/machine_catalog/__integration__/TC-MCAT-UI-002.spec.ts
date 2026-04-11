/**
 * TC-MCAT-UI-002: Edit machine catalog profile via form
 *
 * Business path: Admin opens an existing profile, changes service defaults
 * and adds service notes, saves, verifies changes persist.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import {
  createMachineProfile,
  createProfileInput,
  deleteMachineProfile,
  listMachineProfiles,
} from './helpers/fixtures'

test.describe('TC-MCAT-UI-002: Edit machine catalog profile', () => {
  test('admin edits profile and changes persist', async ({ page, request }) => {
    const token = getCachedToken()
    let profileId: string | null = null
    const updatedNotes = 'QA E2E uwagi serwisowe — zaktualizowane'

    try {
      profileId = await createMachineProfile(request, token, createProfileInput({ defaultTeamSize: 2 }))

      await page.goto(`/backend/machine-catalog/${profileId}`)

      // Wait for form data to load
      await expect(page.getByLabel(/domyślna liczba osób|team size/i)).toHaveValue('2', { timeout: 8_000 })

      // Change team size
      const teamSizeField = page.getByLabel(/domyślna liczba osób|team size/i)
      await teamSizeField.clear()
      await teamSizeField.fill('5')

      // Add service notes
      await page.getByLabel(/uwagi serwisowe|service notes/i).fill(updatedNotes)

      // Deactivate profile
      const activeCheckbox = page.getByLabel(/^aktywny|^active/i)
      if (await activeCheckbox.isChecked()) {
        await activeCheckbox.uncheck()
      }

      // Save
      await page.getByRole('button', { name: /zapisz|save/i }).click()
      await expect(page).toHaveURL(/\/backend\/machine-catalog(\?.*)?$/, { timeout: 10_000 })

      // Verify via API
      const list = await listMachineProfiles(request, token, `ids=${profileId}`)
      const updated = list.items.find((item) => item['id'] === profileId)
      expect(updated?.['defaultTeamSize']).toBe(5)
      expect(updated?.['serviceNotes']).toBe(updatedNotes)
      expect(updated?.['isActive']).toBe(false)
    } finally {
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })
})
