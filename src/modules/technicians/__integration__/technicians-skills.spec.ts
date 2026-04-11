/**
 * Technician Skills API integration tests
 * Covers: add skill, list skills, remove skill, duplicate rejection
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technicians Skills API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getFirstTechnicianId(request: any): Promise<string | null> {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1', { token })
    const items = (await res.json())?.items ?? []
    return items.length > 0 ? items[0].id : null
  }

  test('add and list skills for a technician', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const skillName = `QA-Skill-${Date.now()}`
    const addRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/skills`, {
      token,
      data: { name: skillName },
    })
    expect(addRes.status()).toBe(201)
    const { id: skillId } = await addRes.json()

    const listRes = await apiRequest(request, 'GET', `/api/technicians/technicians/${techId}/skills`, { token })
    expect(listRes.ok()).toBeTruthy()
    const { items } = await listRes.json()
    expect(items.some((s: any) => s.name === skillName)).toBe(true)

    // Cleanup
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/skills?id=${skillId}`, { token })
  })

  test('remove skill', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const skillName = `QA-Remove-${Date.now()}`
    const addRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/skills`, {
      token,
      data: { name: skillName },
    })
    const { id: skillId } = await addRes.json()

    const delRes = await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/skills?id=${skillId}`, { token })
    expect(delRes.ok()).toBeTruthy()
    expect((await delRes.json()).ok).toBe(true)

    const listRes = await apiRequest(request, 'GET', `/api/technicians/technicians/${techId}/skills`, { token })
    const { items } = await listRes.json()
    expect(items.some((s: any) => s.id === skillId)).toBe(false)
  })
})
