/**
 * Reservation Cancel API integration tests
 * Covers: cancel active reservation, reject double-cancel
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Reservation Cancel API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getFirstTechnicianId(request: any): Promise<string | null> {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1&is_active=true', { token })
    const items = (await res.json())?.items ?? []
    return items.length > 0 ? items[0].id : null
  }

  async function deleteReservation(request: any, id: string | null) {
    if (!id) return
    try { await apiRequest(request, 'DELETE', `/api/technician-reservations?id=${id}`, { token }) } catch { /* cleanup */ }
  }

  test('cancel an active reservation', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    let resId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'leave',
          startsAt: '2026-08-01T08:00:00Z',
          endsAt: '2026-08-01T16:00:00Z',
          technicianIds: [techId],
        },
      })
      resId = (await createRes.json()).id

      const cancelRes = await apiRequest(request, 'POST', '/api/technician-reservations/cancel', {
        token,
        data: { id: resId },
      })
      expect(cancelRes.ok()).toBeTruthy()

      // Verify status is cancelled
      const listRes = await apiRequest(request, 'GET', `/api/technician-reservations?ids=${resId}`, { token })
      const items = (await listRes.json())?.items ?? []
      const found = items.find((i: any) => i.id === resId)
      expect(found).toBeDefined()
      expect(found.status).toBe('cancelled')
    } finally {
      await deleteReservation(request, resId)
    }
  })

  test('reject double cancellation with 422', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    let resId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'training',
          startsAt: '2026-08-02T08:00:00Z',
          endsAt: '2026-08-02T12:00:00Z',
          technicianIds: [techId],
        },
      })
      resId = (await createRes.json()).id

      // First cancel
      await apiRequest(request, 'POST', '/api/technician-reservations/cancel', {
        token, data: { id: resId },
      })

      // Second cancel — should return 422
      const doubleCancel = await apiRequest(request, 'POST', '/api/technician-reservations/cancel', {
        token, data: { id: resId },
      })
      expect(doubleCancel.status()).toBe(422)
    } finally {
      await deleteReservation(request, resId)
    }
  })
})
