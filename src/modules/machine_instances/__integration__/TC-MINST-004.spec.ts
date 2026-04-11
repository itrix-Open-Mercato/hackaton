import { expect, test, type APIRequestContext } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { createMachineInstance, createMachineInstanceInput, deleteMachineInstance } from './helpers/fixtures'

test.describe('TC-MINST-004: Machine instances backend UI', () => {
  let token: string
  let instanceId: string | null = null
  let instanceCode: string
  let sharedRequest: APIRequestContext

  test.beforeAll(async ({ request }) => {
    sharedRequest = request
    token = getCachedToken()
    const input = createMachineInstanceInput({ siteName: 'QA UI Test Site 004' })
    instanceCode = input.instanceCode
    instanceId = await createMachineInstance(request, token, input)
  })

  test.afterAll(async () => {
    if (instanceId) await deleteMachineInstance(sharedRequest, token, instanceId)
  })

  test('list page loads and displays machine instances', async ({ page }) => {
    await page.goto('/backend/machine-instances')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('textbox', { name: /search/i }).fill(instanceCode)
    await expect(page.getByText(instanceCode)).toBeVisible()
  })

  test('create page loads with the create form', async ({ page }) => {
    await page.goto('/backend/machine-instances/create')
    await expect(page).toHaveURL(/\/backend\/machine-instances\/create/)
    await expect(page.getByRole('button', { name: /utwórz|create/i }).first()).toBeVisible()
  })
})
