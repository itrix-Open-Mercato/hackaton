import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import {
  createMachineInstance,
  createMachineInstanceInput,
  deleteMachineInstance,
  listMachineInstances,
  updateMachineInstance,
} from './helpers/fixtures'

test.describe('TC-MINST-002: Update machine instance', () => {
  test('updates a machine instance and reflects changes in list', async ({ request }) => {
    const token = getCachedToken()
    let instanceId: string | null = null

    try {
      const input = createMachineInstanceInput()
      instanceId = await createMachineInstance(request, token, input)

      const updatedSiteName = 'Updated QA Site'
      const response = await updateMachineInstance(request, token, instanceId, {
        siteName: updatedSiteName,
        warrantyStatus: 'active',
      })
      expect(response.ok(), `Update failed: ${response.status()}`).toBeTruthy()

      const list = await listMachineInstances(request, token, `search=${encodeURIComponent(input.instanceCode)}`)
      const updated = list.items.find((item) => item['id'] === instanceId)

      expect(updated).toBeTruthy()
      expect(updated?.['siteName']).toBe(updatedSiteName)
      expect(updated?.['warrantyStatus']).toBe('active')
    } finally {
      if (instanceId) await deleteMachineInstance(request, token, instanceId)
    }
  })
})
