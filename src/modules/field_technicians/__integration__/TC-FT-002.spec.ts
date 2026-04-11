/**
 * TC-FT-002: Field Technician Certification CRUD API
 * Source: .ai/specs/2026-04-10-field-technicians-module.md — Integration Coverage
 *
 * Covers:
 *   - Add certification to a technician (technicianId linkage)
 *   - Update certification expires_at
 *   - Soft-delete certification
 *   - Filter certifications by technicianId
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('TC-FT-002: Field Technician Certification CRUD API', () => {
  let token: string
  let technicianId: string | null = null

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
    // Create a shared technician to attach certifications to
    const res = await apiRequest(request, 'POST', '/api/field-technicians', {
      token,
      data: { displayName: `QA FT 002 Parent ${Date.now()}` },
    })
    technicianId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    if (!technicianId) return
    try {
      await apiRequest(request, 'DELETE', `/api/field-technicians?id=${technicianId}`, { token })
    } catch {
      // ignore
    }
  })

  async function deleteCertIfExists(request: Parameters<typeof apiRequest>[0], id: string | null) {
    if (!id) return
    try {
      await apiRequest(request, 'DELETE', `/api/field-technicians/certifications?id=${id}`, { token })
    } catch {
      // ignore
    }
  }

  test('TC-FT-C09: add certification links to technicianId and returns id', async ({ request }) => {
    let certId: string | null = null
    try {
      const res = await apiRequest(request, 'POST', '/api/field-technicians/certifications', {
        token,
        data: {
          technicianId,
          name: 'SEP up to 1kV',
          certType: 'sep',
          code: `SEP-QA-${Date.now()}`,
          expiresAt: '2027-12-31T00:00:00Z',
        },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(typeof body.id).toBe('string')
      certId = body.id

      const listRes = await apiRequest(request, 'GET', `/api/field-technicians/certifications?technicianId=${technicianId}`, { token })
      expect(listRes.ok()).toBeTruthy()
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      const found = items.find((c) => c.id === certId)
      expect(found).toBeDefined()
      expect(found!.technician_id ?? found!.technicianId).toBe(technicianId)
    } finally {
      await deleteCertIfExists(request, certId)
    }
  })

  test('TC-FT-C10: update certification expires_at reflects in GET', async ({ request }) => {
    let certId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/field-technicians/certifications', {
        token,
        data: { technicianId, name: `QA Cert C10 ${Date.now()}`, expiresAt: '2026-06-01T00:00:00Z' },
      })
      certId = (await createRes.json()).id

      const updateRes = await apiRequest(request, 'PUT', '/api/field-technicians/certifications', {
        token,
        data: { id: certId, expiresAt: '2028-01-01T00:00:00Z' },
      })
      expect(updateRes.ok()).toBeTruthy()

      const listRes = await apiRequest(request, 'GET', `/api/field-technicians/certifications?ids=${certId}`, { token })
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      const found = items.find((c) => c.id === certId)
      expect(found).toBeDefined()
      const expiresAt = String(found!.expires_at ?? found!.expiresAt ?? '')
      expect(expiresAt).toContain('2028')
    } finally {
      await deleteCertIfExists(request, certId)
    }
  })

  test('TC-FT-C11: soft-delete certification removes it from default list', async ({ request }) => {
    let certId: string | null = null
    try {
      const createRes = await apiRequest(request, 'POST', '/api/field-technicians/certifications', {
        token,
        data: { technicianId, name: `QA Cert C11 ${Date.now()}` },
      })
      certId = (await createRes.json()).id

      const delRes = await apiRequest(request, 'DELETE', `/api/field-technicians/certifications?id=${certId}`, { token })
      expect(delRes.ok()).toBeTruthy()

      const listRes = await apiRequest(request, 'GET', `/api/field-technicians/certifications?ids=${certId}`, { token })
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      expect(items.some((c) => c.id === certId)).toBe(false)

      certId = null // already deleted
    } finally {
      await deleteCertIfExists(request, certId)
    }
  })

  test('TC-FT-C12: filter by technicianId returns only that technician certs', async ({ request }) => {
    let certId: string | null = null
    let otherTechId: string | null = null
    let otherCertId: string | null = null
    try {
      const suffix = Date.now()
      // Create a second technician and a cert for them
      const techRes = await apiRequest(request, 'POST', '/api/field-technicians', {
        token,
        data: { displayName: `QA FT C12 Other ${suffix}` },
      })
      otherTechId = (await techRes.json()).id

      const [c1, c2] = await Promise.all([
        apiRequest(request, 'POST', '/api/field-technicians/certifications', {
          token,
          data: { technicianId, name: `QA Cert C12 Mine ${suffix}` },
        }),
        apiRequest(request, 'POST', '/api/field-technicians/certifications', {
          token,
          data: { technicianId: otherTechId, name: `QA Cert C12 Other ${suffix}` },
        }),
      ])
      certId = (await c1.json()).id
      otherCertId = (await c2.json()).id

      const listRes = await apiRequest(request, 'GET', `/api/field-technicians/certifications?technicianId=${technicianId}`, { token })
      const items: Array<Record<string, unknown>> = (await listRes.json())?.items ?? []
      expect(items.some((c) => c.id === certId)).toBe(true)
      expect(items.some((c) => c.id === otherCertId)).toBe(false)
    } finally {
      await Promise.all([
        deleteCertIfExists(request, certId),
        deleteCertIfExists(request, otherCertId),
        otherTechId
          ? apiRequest(request, 'DELETE', `/api/field-technicians?id=${otherTechId}`, { token }).catch(() => {})
          : Promise.resolve(),
      ])
    }
  })
})
