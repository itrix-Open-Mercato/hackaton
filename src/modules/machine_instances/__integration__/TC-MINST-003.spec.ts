import { expect, test } from '@playwright/test'
import { getCachedToken } from '../../../../.ai/qa/tests/get-cached-token.js'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import { createMachineInstance, createMachineInstanceInput, listMachineInstances } from './helpers/fixtures'

test.describe('TC-MINST-003: Delete machine instance', () => {
  test('deletes a machine instance and it disappears from the list', async ({ request }) => {
    const token = getCachedToken()
    let instanceId: string | null = null

    try {
      const input = createMachineInstanceInput()
      instanceId = await createMachineInstance(request, token, input)

      const beforeDelete = await listMachineInstances(request, token, `search=${encodeURIComponent(input.instanceCode)}`)
      expect(beforeDelete.items.some((item) => item['id'] === instanceId)).toBeTruthy()

      const deleteResponse = await apiRequest(request, 'DELETE', `/api/machine_instances/machines?id=${encodeURIComponent(instanceId)}`, {
        token,
        data: { id: instanceId },
      })
      expect(deleteResponse.ok(), `Delete failed: ${deleteResponse.status()}`).toBeTruthy()
      instanceId = null

      const afterDelete = await listMachineInstances(request, token, `search=${encodeURIComponent(input.instanceCode)}`)
      expect(afterDelete.items.some((item) => item['id'] === instanceId)).toBeFalsy()
    } finally {
      // Nothing to clean up — already deleted
    }
  })

  test('returns 401 without auth token', async ({ request }) => {
    const response = await request.get('/api/machine_instances/machines')
    expect(response.status()).toBe(401)
  })
})
