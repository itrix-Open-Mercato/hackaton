/**
 * TC-MCAT-UI-004: Machine profile widget on catalog product detail page
 *
 * Business path: Admin creates a catalog product and a matching machine profile,
 * then opens the catalog product detail page and sees the "Profil maszyny" tab
 * with the profile data and part templates.
 */
import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { createProductFixture } from '@open-mercato/core/helpers/integration/catalogFixtures'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import {
  createMachineProfile,
  createPartTemplate,
  createPartTemplateInput,
  createProfileInput,
  deleteMachineProfile,
  deletePartTemplate,
} from './helpers/fixtures'

test.describe('TC-MCAT-UI-004: Machine profile widget on catalog product detail', () => {
  test('widget tab appears and shows profile data with part templates', async ({ page, request }) => {
    const token = getCachedToken()
    let productId: string | null = null
    let profileId: string | null = null
    let templateId: string | null = null

    try {
      // Create a real catalog product
      const sku = `QA-MCAT-${Date.now()}`
      productId = await createProductFixture(request, token, { title: `QA Machine Product ${sku}`, sku })

      // Create a machine profile linked to that product
      profileId = await createMachineProfile(request, token, createProfileInput({
        catalogProductId: productId,
        machineFamily: 'QA-Widget-Family',
        modelCode: 'QA-MDL-WGT',
        defaultTeamSize: 4,
        defaultServiceDurationMinutes: 60,
      }))

      // Create a part template for that profile
      const ptInput = createPartTemplateInput(profileId, {
        partName: 'QA Widget Part',
        templateType: 'component',
        serviceContext: 'preventive',
        quantityDefault: 2,
        quantityUnit: 'szt',
      })
      templateId = await createPartTemplate(request, token, ptInput)

      // Open catalog product detail page
      await page.goto(`/backend/catalog/products/${productId}`)
      await expect(page).toHaveURL(/\/backend\/catalog\/products\//)

      // Look for the "Profil maszyny" tab injected by our widget
      const profileTab = page.getByRole('tab', { name: /profil maszyny|machine profile/i })
      await expect(profileTab).toBeVisible({ timeout: 10_000 })
      await profileTab.click()

      // Widget should show machine family and model code
      await expect(page.getByText('QA-Widget-Family')).toBeVisible({ timeout: 8_000 })
      await expect(page.getByText('QA-MDL-WGT')).toBeVisible()

      // Part template should be listed
      await expect(page.getByText('QA Widget Part')).toBeVisible()
    } finally {
      if (templateId) await deletePartTemplate(request, token, templateId)
      if (profileId) await deleteMachineProfile(request, token, profileId)
      if (productId) {
        try {
          await apiRequest(request, 'DELETE', `/api/catalog/products?id=${encodeURIComponent(productId)}`, { token, data: { id: productId } })
        } catch { /* ignore */ }
      }
    }
  })

  test('widget shows "Dodaj profil" button when no profile exists', async ({ page, request }) => {
    const token = getCachedToken()
    let productId: string | null = null

    try {
      const sku = `QA-NOPROF-${Date.now()}`
      productId = await createProductFixture(request, token, { title: `QA No Profile Product ${sku}`, sku })

      await page.goto(`/backend/catalog/products/${productId}`)

      const profileTab = page.getByRole('tab', { name: /profil maszyny|machine profile/i })
      await expect(profileTab).toBeVisible({ timeout: 10_000 })
      await profileTab.click()

      // Should show "Dodaj profil" or "no profile" message
      await expect(
        page.getByText(/dodaj profil|brak.*profil|no.*profile|add profile/i),
      ).toBeVisible({ timeout: 8_000 })
    } finally {
      if (productId) {
        try {
          await apiRequest(request, 'DELETE', `/api/catalog/products?id=${encodeURIComponent(productId)}`, { token, data: { id: productId } })
        } catch { /* ignore */ }
      }
    }
  })
})
