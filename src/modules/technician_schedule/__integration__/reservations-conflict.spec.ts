/**
 * Reservation Overlap Conflict detection integration tests
 * Covers: overlap 409, no conflict for different technician, self-update allowed
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Reservation Conflict Detection', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getTechnicianIds(request: any, count: number): Promise<string[]> {
    const res = await apiRequest(request, 'GET', `/api/technicians/technicians?page=1&pageSize=${count}&is_active=true`, { token })
    const items = (await res.json())?.items ?? []
    return items.map((i: any) => i.id)
  }

  async function deleteReservation(request: any, id: string | null) {
    if (!id) return
    try { await apiRequest(request, 'DELETE', `/api/technician-reservations?id=${id}`, { token }) } catch { /* cleanup */ }
  }

  test('create reservation with time conflict returns 409', async ({ request }) => {
    const techIds = await getTechnicianIds(request, 1)
    if (techIds.length === 0) { test.skip(); return }
    const techId = techIds[0]

    let resId: string | null = null
    try {
      // Create first reservation
      const res1 = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-09-01T09:00:00Z',
          endsAt: '2026-09-01T11:00:00Z',
          technicianIds: [techId],
        },
      })
      expect(res1.ok()).toBeTruthy()
      resId = (await res1.json()).id

      // Attempt overlapping reservation for same technician
      const conflictRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-09-01T10:00:00Z',
          endsAt: '2026-09-01T12:00:00Z',
          technicianIds: [techId],
        },
      })
      expect(conflictRes.status()).toBe(409)
      const body = await conflictRes.json()
      expect(body.error).toBe('OVERLAP_CONFLICT')
      expect(body.conflictingTechnicianIds).toContain(techId)
    } finally {
      await deleteReservation(request, resId)
    }
  })

  test('no conflict for different technician at same time', async ({ request }) => {
    const techIds = await getTechnicianIds(request, 2)
    if (techIds.length < 2) { test.skip(); return }

    let resId1: string | null = null
    let resId2: string | null = null
    try {
      const res1 = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-09-02T09:00:00Z',
          endsAt: '2026-09-02T11:00:00Z',
          technicianIds: [techIds[0]],
        },
      })
      resId1 = (await res1.json()).id

      const res2 = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-09-02T09:00:00Z',
          endsAt: '2026-09-02T11:00:00Z',
          technicianIds: [techIds[1]],
        },
      })
      expect(res2.ok()).toBeTruthy()
      resId2 = (await res2.json()).id
    } finally {
      await deleteReservation(request, resId1)
      await deleteReservation(request, resId2)
    }
  })

  test('self-update does not trigger conflict', async ({ request }) => {
    const techIds = await getTechnicianIds(request, 1)
    if (techIds.length === 0) { test.skip(); return }

    let resId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-09-03T09:00:00Z',
          endsAt: '2026-09-03T11:00:00Z',
          technicianIds: [techIds[0]],
        },
      })
      resId = (await createRes.json()).id

      // Update same reservation with shifted time — should not conflict with itself
      const updateRes = await apiRequest(request, 'PUT', '/api/technician-reservations', {
        token,
        data: {
          id: resId,
          startsAt: '2026-09-03T10:00:00Z',
          endsAt: '2026-09-03T12:00:00Z',
        },
      })
      expect(updateRes.ok()).toBeTruthy()
    } finally {
      await deleteReservation(request, resId)
    }
  })
})
