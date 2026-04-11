/**
 * TC-FT-001: Field Technician CRUD API
 * Source: .ai/specs/2026-04-10-field-technicians-module.md — Integration Coverage
 *
 * Covers:
 *   - Create technician with minimum required fields
 *   - Create technician with all optional fields (round-trip)
 *   - Update locationStatus
 *   - Soft-delete (record hidden from default list)
 *   - Filter by locationStatus
 *   - Search by displayName partial match
 *   - Filter by ids (batch lookup)
 *   - pageSize cap at 100
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

const MODULE = 'field_technicians'

test.describe('TC-FT-001: Field Technician CRUD API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function deleteIfExists(request: Parameters<typeof apiRequest>[0], id: string | null) {
    if (!id) return
    try {
      await apiRequest(request, 'DELETE', `/api/field-technicians?id=${id}`, { token })
    } catch {
      // ignore cleanup failures
    }
  }

  test('TC-FT-C01: create with minimum required fields returns id; list includes it', async ({ request }) => {
    let id: string | null = null
    try {
      const suffix = Date.now()
      const res = await apiRequest(request, 'POST', '/api/field-technicians', {
        token,
        data: { displayName: `QA FT C01 ${suffix}` },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(typeof body.id).toBe('string')
      id = body.id

      const listRes = await apiRequest(request, 'GET', `/api/field-technicians?ids=${id}`, { token })
      expect(listRes.ok()).toBeTruthy()
      const listBody = await listRes.json()
      const items: Array<Record<string, unknown>> = listBody?.items ?? listBody?.data ?? []
      expect(items.some((t) => t.id === id)).toBe(true)
    } finally {
      await deleteIfExists(request, id)
    }
  })

  test('TC-FT-C02: create with all optional fields round-trips correctly', async ({ request }) => {
    let id: string | null = null
    try {
      const suffix = Date.now()
      const payload = {
        displayName: `QA FT C02 ${suffix}`,
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: `qa.ft.c02.${suffix}@example.com`,
        phone: '+48600000001',
        locationStatus: 'on_trip',
        skills: ['heat pump', 'CNC'],
        languages: ['pl', 'en'],
        notes: 'Integration test record',
        isActive: true,
      }
      const res = await apiRequest(request, 'POST', '/api/field-technicians', { token, data: payload })
      expect(res.ok()).toBeTruthy()
      id = (await res.json()).id

      const listRes = await apiRequest(request, 'GET', `/api/field-technicians?ids=${id}`, { token })
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      const found = items.find((t) => t.id === id)
      expect(found).toBeDefined()
      expect(found!.first_name).toBe('Jan')
      expect(found!.last_name).toBe('Kowalski')
      expect(found!.location_status).toBe('on_trip')
      expect(found!.email).toBe(payload.email)
      // skills should be normalised to lowercase
      expect(Array.isArray(found!.skills)).toBe(true)
      const skills = found!.skills as string[]
      expect(skills).toContain('heat pump')
      expect(skills).toContain('cnc')
    } finally {
      await deleteIfExists(request, id)
    }
  })

  test('TC-FT-C03: update locationStatus reflects in GET', async ({ request }) => {
    let id: string | null = null
    try {
      const suffix = Date.now()
      const createRes = await apiRequest(request, 'POST', '/api/field-technicians', {
        token,
        data: { displayName: `QA FT C03 ${suffix}`, locationStatus: 'in_office' },
      })
      id = (await createRes.json()).id

      const updateRes = await apiRequest(request, 'PUT', '/api/field-technicians', {
        token,
        data: { id, locationStatus: 'at_client' },
      })
      expect(updateRes.ok()).toBeTruthy()

      const getRes = await apiRequest(request, 'GET', `/api/field-technicians?ids=${id}`, { token })
      const items: Array<Record<string, unknown>> = (await getRes.json())?.items ?? []
      const found = items.find((t) => t.id === id)
      expect(found!.location_status).toBe('at_client')
    } finally {
      await deleteIfExists(request, id)
    }
  })

  test('TC-FT-C04: soft-delete hides record from default list', async ({ request }) => {
    let id: string | null = null
    try {
      const suffix = Date.now()
      const createRes = await apiRequest(request, 'POST', '/api/field-technicians', {
        token,
        data: { displayName: `QA FT C04 ${suffix}` },
      })
      id = (await createRes.json()).id

      const delRes = await apiRequest(request, 'DELETE', `/api/field-technicians?id=${id}`, { token })
      expect(delRes.ok()).toBeTruthy()

      // default list should not include soft-deleted record
      const listRes = await apiRequest(request, 'GET', `/api/field-technicians?ids=${id}`, { token })
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      expect(items.some((t) => t.id === id)).toBe(false)

      id = null // already deleted; skip cleanup
    } finally {
      await deleteIfExists(request, id)
    }
  })

  test('TC-FT-C05: filter by locationStatus returns only matching records', async ({ request }) => {
    let idA: string | null = null
    let idB: string | null = null
    try {
      const suffix = Date.now()
      const [a, b] = await Promise.all([
        apiRequest(request, 'POST', '/api/field-technicians', {
          token,
          data: { displayName: `QA FT C05 A ${suffix}`, locationStatus: 'in_office' },
        }),
        apiRequest(request, 'POST', '/api/field-technicians', {
          token,
          data: { displayName: `QA FT C05 B ${suffix}`, locationStatus: 'unavailable' },
        }),
      ])
      idA = (await a.json()).id
      idB = (await b.json()).id

      const res = await apiRequest(request, 'GET', `/api/field-technicians?locationStatus=in_office&ids=${idA},${idB}`, { token })
      const items: Array<Record<string, unknown>> = (await res.json())?.items ?? []
      expect(items.some((t) => t.id === idA)).toBe(true)
      expect(items.some((t) => t.id === idB)).toBe(false)
    } finally {
      await Promise.all([deleteIfExists(request, idA), deleteIfExists(request, idB)])
    }
  })

  test('TC-FT-C06: search by displayName partial match returns hit', async ({ request }) => {
    let id: string | null = null
    try {
      const unique = `QA-FT-C06-${Date.now()}`
      const res = await apiRequest(request, 'POST', '/api/field-technicians', {
        token,
        data: { displayName: unique },
      })
      id = (await res.json()).id

      const searchRes = await apiRequest(request, 'GET', `/api/field-technicians?search=${encodeURIComponent('QA-FT-C06')}`, { token })
      const items: Array<Record<string, unknown>> = (await searchRes.json())?.items ?? []
      expect(items.some((t) => t.id === id)).toBe(true)
    } finally {
      await deleteIfExists(request, id)
    }
  })

  test('TC-FT-C07: ids filter returns only requested records', async ({ request }) => {
    let idA: string | null = null
    let idB: string | null = null
    let idC: string | null = null
    try {
      const suffix = Date.now()
      const [a, b, c] = await Promise.all([
        apiRequest(request, 'POST', '/api/field-technicians', { token, data: { displayName: `QA FT C07 A ${suffix}` } }),
        apiRequest(request, 'POST', '/api/field-technicians', { token, data: { displayName: `QA FT C07 B ${suffix}` } }),
        apiRequest(request, 'POST', '/api/field-technicians', { token, data: { displayName: `QA FT C07 C ${suffix}` } }),
      ])
      idA = (await a.json()).id
      idB = (await b.json()).id
      idC = (await c.json()).id

      const res = await apiRequest(request, 'GET', `/api/field-technicians?ids=${idA},${idB}`, { token })
      const items: Array<Record<string, unknown>> = (await res.json())?.items ?? []
      const returnedIds = items.map((t) => t.id)
      expect(returnedIds).toContain(idA)
      expect(returnedIds).toContain(idB)
      expect(returnedIds).not.toContain(idC)
    } finally {
      await Promise.all([deleteIfExists(request, idA), deleteIfExists(request, idB), deleteIfExists(request, idC)])
    }
  })

  test('TC-FT-C08: pageSize over 100 is capped at 100', async ({ request }) => {
    const res = await apiRequest(request, 'GET', '/api/field-technicians?pageSize=200', { token })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // pageSize is capped — meta.pageSize should not exceed 100
    const pageSize = body?.meta?.pageSize ?? body?.pageSize ?? body?.items?.length
    expect(pageSize).toBeLessThanOrEqual(100)
  })
})
