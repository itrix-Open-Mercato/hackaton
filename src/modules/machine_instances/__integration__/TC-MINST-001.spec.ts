import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { createMachineInstance, createMachineInstanceInput, deleteMachineInstance, listMachineInstances } from './helpers/fixtures'

test.describe('TC-MINST-001: Create machine instance, verify in list', () => {
  test('creates a machine instance and returns it in the list', async ({ request }) => {
    const token = getCachedToken()
    let instanceId: string | null = null

    try {
      const input = createMachineInstanceInput()

      instanceId = await createMachineInstance(request, token, input)

      const list = await listMachineInstances(request, token, `search=${encodeURIComponent(input.instanceCode)}`)
      const created = list.items.find((item) => item['id'] === instanceId)

      expect(created).toBeTruthy()
      expect(created?.['instanceCode']).toBe(input.instanceCode)
      expect(created?.['serialNumber']).toBe(input.serialNumber)
      expect(created?.['isActive']).toBe(true)
    } finally {
      if (instanceId) await deleteMachineInstance(request, token, instanceId)
    }
  })
})
