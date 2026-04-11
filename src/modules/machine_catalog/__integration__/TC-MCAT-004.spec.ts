import { expect, test, type APIRequestContext } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { createMachineProfile, createProfileInput, deleteMachineProfile } from './helpers/fixtures'

test.describe('TC-MCAT-004: Machine catalog backend UI', () => {
  let token: string
  let profileId: string | null = null
  let sharedRequest: APIRequestContext

  test.beforeAll(async ({ request }) => {
    sharedRequest = request
    token = getCachedToken()
    profileId = await createMachineProfile(request, token, createProfileInput({ machineFamily: 'QA-UI-Family-004' }))
  })

  test.afterAll(async () => {
    if (profileId) await deleteMachineProfile(sharedRequest, token, profileId)
  })

  test('list page loads and displays machine profiles', async ({ page }) => {
    await page.goto('/backend/machine-catalog')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('textbox', { name: /search/i }).fill('QA-UI-Family-004')
    await expect(page.getByText('QA-UI-Family-004')).toBeVisible()
  })

  test('create page loads with the create form', async ({ page }) => {
    await page.goto('/backend/machine-catalog/create')
    await expect(page).toHaveURL(/\/backend\/machine-catalog\/create/)
    await expect(page.getByRole('button', { name: /utwórz|create/i }).first()).toBeVisible()
  })

  test('unauthenticated user is redirected from list page', async ({ browser }) => {
    // Use a fresh context with no storage state to test the unauthenticated flow
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/backend/machine-catalog')
    await expect(page).toHaveURL(/\/login/)
    await ctx.close()
  })
})
