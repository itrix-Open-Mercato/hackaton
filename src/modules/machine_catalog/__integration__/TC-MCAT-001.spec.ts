import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { createMachineProfile, createProfileInput, deleteMachineProfile, listMachineProfiles } from './helpers/fixtures'

test.describe('TC-MCAT-001: Create machine catalog profile, verify in list', () => {
  test('creates a profile and returns it in the list', async ({ request }) => {
    const token = getCachedToken()
    let profileId: string | null = null

    try {
      const input = createProfileInput()

      profileId = await createMachineProfile(request, token, input)

      const list = await listMachineProfiles(request, token, `search=${encodeURIComponent(input.machineFamily!)}`)
      const created = list.items.find((item) => item['id'] === profileId)

      expect(created).toBeTruthy()
      expect(created?.['machineFamily']).toBe(input.machineFamily)
      expect(created?.['modelCode']).toBe(input.modelCode)
      expect(created?.['isActive']).toBe(true)
    } finally {
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })

  test('filters profiles by catalogProductId', async ({ request }) => {
    const token = getCachedToken()
    let profileId: string | null = null
    const testProductId = '00000000-0000-4000-8000-000000000001'

    try {
      profileId = await createMachineProfile(request, token, createProfileInput({ catalogProductId: testProductId }))

      const list = await listMachineProfiles(request, token, `catalogProductId=${testProductId}&pageSize=100`)
      const found = list.items.find((item) => item['id'] === profileId)

      expect(found).toBeTruthy()
      expect(found?.['catalogProductId']).toBe(testProductId)
    } finally {
      if (profileId) await deleteMachineProfile(request, token, profileId)
    }
  })
})
