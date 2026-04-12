/**
 * Technician Availability API integration tests
 * Covers: create, list with date range, update day type, delete
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technicians Availability API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getFirstTechnicianId(request: any): Promise<string | null> {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1', { token })
    const items = (await res.json())?.items ?? []
    return items.length > 0 ? items[0].id : null
  }

  test('create availability record', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const createRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/availability`, {
      token,
      data: { date: '2026-07-15', day_type: 'holiday' },
    })
    expect(createRes.ok()).toBeTruthy()
    const { id } = await createRes.json()
    expect(typeof id).toBe('string')

    // Cleanup
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/availability?id=${id}`, { token })
  })

  test('list availability with date range filter', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    // Create two records
    const res1 = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/availability`, {
      token, data: { date: '2026-08-01', day_type: 'work_day' },
    })
    const id1 = (await res1.json()).id

    const res2 = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/availability`, {
      token, data: { date: '2026-08-15', day_type: 'trip' },
    })
    const id2 = (await res2.json()).id

    // Filter to first half of month
    const listRes = await apiRequest(request, 'GET',
      `/api/technicians/technicians/${techId}/availability?dateFrom=2026-08-01&dateTo=2026-08-10`, { token })
    expect(listRes.ok()).toBeTruthy()
    const { items } = await listRes.json()
    expect(items.some((a: any) => a.date === '2026-08-01')).toBe(true)
    expect(items.some((a: any) => a.date === '2026-08-15')).toBe(false)

    // Cleanup
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/availability?id=${id1}`, { token })
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/availability?id=${id2}`, { token })
  })

  test('update availability day type', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const createRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/availability`, {
      token, data: { date: '2026-09-01', day_type: 'work_day' },
    })
    const { id } = await createRes.json()

    const updateRes = await apiRequest(request, 'PUT', `/api/technicians/technicians/${techId}/availability`, {
      token, data: { id, day_type: 'trip' },
    })
    expect(updateRes.ok()).toBeTruthy()

    // Cleanup
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/availability?id=${id}`, { token })
  })

  test('delete availability record', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const createRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/availability`, {
      token, data: { date: '2026-09-15', day_type: 'holiday' },
    })
    const { id } = await createRes.json()

    const deleteRes = await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/availability?id=${id}`, { token })
    expect(deleteRes.ok()).toBeTruthy()
    expect((await deleteRes.json()).ok).toBe(true)
  })
})
