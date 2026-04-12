/**
 * Reservation CRUD API integration tests
 * Covers: create, list with filters, update, delete, unauthorized
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Reservation CRUD API', () => {
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

  test('create reservation and verify in list', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    let resId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-07-01T09:00:00Z',
          endsAt: '2026-07-01T11:00:00Z',
          technicianIds: [techId],
          customerName: 'QA CRUD Test',
        },
      })
      expect(createRes.ok()).toBeTruthy()
      resId = (await createRes.json()).id
      expect(typeof resId).toBe('string')

      const listRes = await apiRequest(request, 'GET', `/api/technician-reservations?ids=${resId}`, { token })
      expect(listRes.ok()).toBeTruthy()
      const { items } = await listRes.json()
      expect(items.some((i: any) => i.id === resId)).toBe(true)
    } finally {
      await deleteReservation(request, resId)
    }
  })

  test('list reservations filtered by technician', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const res = await apiRequest(request, 'GET', `/api/technician-reservations?technicianId=${techId}&page=1&pageSize=10`, { token })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('list reservations filtered by date range', async ({ request }) => {
    const res = await apiRequest(request, 'GET',
      '/api/technician-reservations?startsAtFrom=2026-07-01T00:00:00Z&startsAtTo=2026-07-31T23:59:59Z&page=1&pageSize=10', { token })
    expect(res.ok()).toBeTruthy()
  })

  test('list reservations filtered by type', async ({ request }) => {
    const res = await apiRequest(request, 'GET', '/api/technician-reservations?reservationType=leave&page=1&pageSize=10', { token })
    expect(res.ok()).toBeTruthy()
  })

  test('update reservation', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    let resId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'internal_work',
          startsAt: '2026-07-02T08:00:00Z',
          endsAt: '2026-07-02T10:00:00Z',
          technicianIds: [techId],
        },
      })
      resId = (await createRes.json()).id

      const updateRes = await apiRequest(request, 'PUT', '/api/technician-reservations', {
        token,
        data: { id: resId, customerName: 'Updated Corp' },
      })
      expect(updateRes.ok()).toBeTruthy()
    } finally {
      await deleteReservation(request, resId)
    }
  })

  test('delete reservation (soft)', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
      token,
      data: {
        reservationType: 'training',
        startsAt: '2026-07-03T08:00:00Z',
        endsAt: '2026-07-03T10:00:00Z',
        technicianIds: [techId],
      },
    })
    const resId = (await createRes.json()).id

    const delRes = await apiRequest(request, 'DELETE', `/api/technician-reservations?id=${resId}`, { token })
    expect(delRes.ok()).toBeTruthy()
  })

  test('unauthorized access rejected', async ({ request }) => {
    const res = await apiRequest(request, 'GET', '/api/technician-reservations', { token: 'invalid-token' })
    expect(res.ok()).toBeFalsy()
  })
})
