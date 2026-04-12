/**
 * TC-TS-001: Technician Schedule Reservation API
 * Source: .ai/specs/2026-04-11-technician-schedule-module.md
 *
 * Covers:
 *   - Create manual reservation with technician assignment
 *   - Update reservation time and technician assignments
 *   - Cancel reservation via dedicated endpoint
 *   - Reject overlapping reservations for the same technician
 *   - Combine ids and technicianId filters safely
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('TC-TS-001: Technician Schedule Reservation API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function createTechnician(request: Parameters<typeof apiRequest>[0], suffix: string) {
    const response = await apiRequest(request, 'POST', '/api/technicians/technicians', {
      token,
      data: { displayName: `QA TS ${suffix} ${Date.now()}` },
    })
    expect(response.ok()).toBeTruthy()
    return (await response.json()).id as string
  }

  async function deleteTechnicianIfExists(request: Parameters<typeof apiRequest>[0], id: string | null) {
    if (!id) return
    try {
      await apiRequest(request, 'DELETE', `/api/technicians/technicians?id=${id}`, { token })
    } catch {
      // ignore cleanup failures
    }
  }

  async function deleteReservationIfExists(request: Parameters<typeof apiRequest>[0], id: string | null) {
    if (!id) return
    try {
      await apiRequest(request, 'DELETE', `/api/technician-reservations?id=${id}`, { token })
    } catch {
      // ignore cleanup failures
    }
  }

  test('TC-TS-C01: create reservation returns id and assigned technician is listed', async ({ request }) => {
    let technicianId: string | null = null
    let reservationId: string | null = null

    try {
      technicianId = await createTechnician(request, 'C01')

      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-06-01T08:00:00Z',
          endsAt: '2026-06-01T10:00:00Z',
          technicianIds: [technicianId],
          customerName: 'QA Customer C01',
          address: 'Warsaw',
          notes: 'Created by integration test',
        },
      })
      expect(createRes.ok()).toBeTruthy()
      reservationId = (await createRes.json()).id
      expect(typeof reservationId).toBe('string')

      const listRes = await apiRequest(
        request,
        'GET',
        `/api/technician-reservations?ids=${reservationId}&technicianId=${technicianId}&page=1&pageSize=10`,
        { token },
      )
      expect(listRes.ok()).toBeTruthy()
      const listBody = await listRes.json()
      const items: Array<Record<string, unknown>> = listBody?.items ?? []
      const found = items.find((item) => item.id === reservationId)
      expect(found).toBeDefined()
      expect(found!.status).toBe('confirmed')
      expect(found!.source_type).toBe('manual')
      expect(found!.customer_name).toBe('QA Customer C01')
      expect(found!.technicians).toEqual([technicianId])

      const techniciansRes = await apiRequest(
        request,
        'GET',
        `/api/technician-reservations/technicians?reservationId=${reservationId}`,
        { token },
      )
      expect(techniciansRes.ok()).toBeTruthy()
      const techniciansBody = await techniciansRes.json()
      const assignments: Array<Record<string, unknown>> = techniciansBody?.items ?? []
      expect(assignments.some((item) => item.technician_id === technicianId)).toBe(true)
    } finally {
      await Promise.all([
        deleteReservationIfExists(request, reservationId),
        deleteTechnicianIfExists(request, technicianId),
      ])
    }
  })

  test('TC-TS-C02: update reservation changes time window and technician assignments', async ({ request }) => {
    let technicianA: string | null = null
    let technicianB: string | null = null
    let reservationId: string | null = null

    try {
      technicianA = await createTechnician(request, 'C02-A')
      technicianB = await createTechnician(request, 'C02-B')

      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'internal_work',
          startsAt: '2026-06-02T08:00:00Z',
          endsAt: '2026-06-02T09:00:00Z',
          technicianIds: [technicianA],
          notes: 'Initial note',
        },
      })
      reservationId = (await createRes.json()).id

      const updateRes = await apiRequest(request, 'PUT', '/api/technician-reservations', {
        token,
        data: {
          id: reservationId,
          reservationType: 'training',
          startsAt: '2026-06-02T10:00:00Z',
          endsAt: '2026-06-02T12:00:00Z',
          technicianIds: [technicianB],
          notes: 'Updated note',
        },
      })
      expect(updateRes.ok()).toBeTruthy()

      const listRes = await apiRequest(request, 'GET', `/api/technician-reservations?ids=${reservationId}`, { token })
      expect(listRes.ok()).toBeTruthy()
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      const found = items.find((item) => item.id === reservationId)
      expect(found).toBeDefined()
      expect(found!.reservation_type).toBe('training')
      expect(String(found!.starts_at)).toContain('2026-06-02T10:00:00')
      expect(String(found!.ends_at)).toContain('2026-06-02T12:00:00')
      expect(found!.notes).toBe('Updated note')
      expect(found!.technicians).toEqual([technicianB])
    } finally {
      await Promise.all([
        deleteReservationIfExists(request, reservationId),
        deleteTechnicianIfExists(request, technicianA),
        deleteTechnicianIfExists(request, technicianB),
      ])
    }
  })

  test('TC-TS-C03: cancel endpoint marks reservation as cancelled', async ({ request }) => {
    let technicianId: string | null = null
    let reservationId: string | null = null

    try {
      technicianId = await createTechnician(request, 'C03')

      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'leave',
          startsAt: '2026-06-03T08:00:00Z',
          endsAt: '2026-06-03T16:00:00Z',
          technicianIds: [technicianId],
        },
      })
      reservationId = (await createRes.json()).id

      const cancelRes = await apiRequest(request, 'POST', '/api/technician-reservations/cancel', {
        token,
        data: { id: reservationId, notes: 'Cancelled by integration test' },
      })
      expect(cancelRes.ok()).toBeTruthy()

      const listRes = await apiRequest(request, 'GET', `/api/technician-reservations?ids=${reservationId}`, { token })
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      const found = items.find((item) => item.id === reservationId)
      expect(found).toBeDefined()
      expect(found!.status).toBe('cancelled')
      expect(found!.notes).toBe('Cancelled by integration test')
    } finally {
      await Promise.all([
        deleteReservationIfExists(request, reservationId),
        deleteTechnicianIfExists(request, technicianId),
      ])
    }
  })

  test('TC-TS-C04: overlapping reservation for the same technician returns 409 conflict', async ({ request }) => {
    let technicianId: string | null = null
    let reservationId: string | null = null

    try {
      technicianId = await createTechnician(request, 'C04')

      const createRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-06-04T09:00:00Z',
          endsAt: '2026-06-04T11:00:00Z',
          technicianIds: [technicianId],
        },
      })
      expect(createRes.ok()).toBeTruthy()
      reservationId = (await createRes.json()).id

      const conflictRes = await apiRequest(request, 'POST', '/api/technician-reservations', {
        token,
        data: {
          reservationType: 'client_visit',
          startsAt: '2026-06-04T10:00:00Z',
          endsAt: '2026-06-04T12:00:00Z',
          technicianIds: [technicianId],
        },
      })
      expect(conflictRes.status()).toBe(409)
      const body = await conflictRes.json()
      expect(body?.error).toBe('OVERLAP_CONFLICT')
      expect(body?.conflictingTechnicianIds).toContain(technicianId)
    } finally {
      await Promise.all([
        deleteReservationIfExists(request, reservationId),
        deleteTechnicianIfExists(request, technicianId),
      ])
    }
  })
})
