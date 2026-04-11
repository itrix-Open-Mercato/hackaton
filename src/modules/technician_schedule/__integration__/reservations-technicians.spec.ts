/**
 * Reservation Technicians list API integration tests
 * Covers: list technicians for a reservation
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Reservation Technicians API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getFirstTechnicianId(request: any): Promise<string | null> {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1&is_active=true', { token })
    const items = (await res.json())?.items ?? []
    return items.length > 0 ? items[0].id : null
  }

  test('list technicians for a reservation', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    let resId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-10-01T09:00:00Z',
          endsAt: '2026-10-01T11:00:00Z',
          technicianIds: [techId],
        },
      })
      resId = (await createRes.json()).id

      const techRes = await apiRequest(request, 'GET',
        `/api/technician-reservations/technicians?reservationId=${resId}`, { token })
      expect(techRes.ok()).toBeTruthy()
      const body = await techRes.json()
      const assignments = body?.items ?? []
      expect(assignments.some((a: any) => a.technician_id === techId)).toBe(true)
    } finally {
      if (resId) {
        try { await apiRequest(request, 'DELETE', `/api/technician-reservations?id=${resId}`, { token }) } catch { /* cleanup */ }
      }
    }
  })
})
