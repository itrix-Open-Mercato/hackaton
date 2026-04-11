/**
 * TC-MCAT-UI-001: Create machine catalog profile via form
 *
 * Business path: Admin navigates to the machine catalog list,
 * clicks "Nowy profil", fills the form with catalog product ID
 * and machine details, submits, and sees the profile in the list.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { deleteMachineProfile, listMachineProfiles } from './helpers/fixtures'

// Stable fake UUID used as catalogProductId in E2E tests
const FAKE_PRODUCT_UUID = '00000000-0000-4000-8000-000000000099'

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

test.describe('TC-MCAT-UI-001: Create machine catalog profile via form', () => {
  test('admin fills form and sees new profile in list', async ({ page, request }) => {
    const token = getCachedToken()
    let profileId: string | null = null
    const machineFamily = unique('QA-Fam')
    const modelCode = unique('MDL')

    try {
      // Navigate to list and click create
      await page.goto('/backend/machine-catalog')
      await expect(page.getByRole('table')).toBeVisible()
      await page.getByRole('link', { name: /nowy profil|new profile/i }).click()
      await expect(page).toHaveURL(/\/backend\/machine-catalog\/create/)

      // Fill required field: Catalog Product ID
      await page.getByLabel(/id produktu katalogowego|catalog product id/i).fill(FAKE_PRODUCT_UUID)

      // Fill identity fields
      await page.getByLabel(/rodzina maszyn|machine family/i).fill(machineFamily)
      await page.getByLabel(/kod modelu|model code/i).fill(modelCode)

      // Fill service defaults
      await page.getByLabel(/domyślna liczba osób|team size/i).fill('3')
      await page.getByLabel(/domyślny czas serwisu|service duration/i).fill('90')
      await page.getByLabel(/interwał pm|preventive maintenance/i).fill('180')

      // Submit
      await page.getByRole('button', { name: /utwórz|create/i }).click()

      // Should redirect to list
      await expect(page).toHaveURL(/\/backend\/machine-catalog(\?.*)?$/, { timeout: 10_000 })

      // Record should appear in list
      await page.getByRole('textbox', { name: /szukaj|search/i }).fill(machineFamily)
      await expect(page.getByText(machineFamily)).toBeVisible({ timeout: 8_000 })

      // Capture ID for cleanup
      const list = await listMachineProfiles(request, token, `search=${encodeURIComponent(machineFamily)}`)
      profileId = (list.items[0]?.['id'] as string) ?? null
    } finally {
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })

  test('required catalog product ID prevents empty submission', async ({ page }) => {
    await page.goto('/backend/machine-catalog/create')

    // Try to submit without filling required catalogProductId
    await page.getByRole('button', { name: /utwórz|create/i }).click()

    // Should stay on create page
    await expect(page).toHaveURL(/\/backend\/machine-catalog\/create/)
  })
})
