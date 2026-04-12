/**
 * Technician Certifications API integration tests
 * Covers: add cert with enhanced fields, update, list with expiry, remove
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technicians Certifications API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getFirstTechnicianId(request: any): Promise<string | null> {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1', { token })
    const items = (await res.json())?.items ?? []
    return items.length > 0 ? items[0].id : null
  }

  test('add certification with enhanced fields', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const addRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/certifications`, {
      token,
      data: {
        name: `QA Cert ${Date.now()}`,
        cert_type: 'quality',
        code: 'QA-001',
        issued_by: 'Test Authority',
        issued_at: '2026-01-01',
        expires_at: '2028-01-01',
        notes: 'Test certification',
      },
    })
    expect(addRes.status()).toBe(201)
    const { id: certId } = await addRes.json()
    expect(typeof certId).toBe('string')

    // Verify in list
    const listRes = await apiRequest(request, 'GET', `/api/technicians/technicians/${techId}/certifications`, { token })
    expect(listRes.ok()).toBeTruthy()
    const { items } = await listRes.json()
    const found = items.find((c: any) => c.id === certId)
    expect(found).toBeDefined()
    expect(found.certType).toBe('quality')
    expect(found.code).toBe('QA-001')
    expect(found.issuedBy).toBe('Test Authority')
    expect(found.notes).toBe('Test certification')
    expect(typeof found.isExpired).toBe('boolean')

    // Cleanup
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/certifications?id=${certId}`, { token })
  })

  test('update certification enhanced fields', async ({ request }) => {
    const techId = await getFirstTechnicianId(request)
    if (!techId) { test.skip(); return }

    const addRes = await apiRequest(request, 'POST', `/api/technicians/technicians/${techId}/certifications`, {
      token,
      data: { name: `QA Update Cert ${Date.now()}` },
    })
    const { id: certId } = await addRes.json()

    const updateRes = await apiRequest(request, 'PUT', `/api/technicians/technicians/${techId}/certifications`, {
      token,
      data: { id: certId, notes: 'Updated notes', cert_type: 'safety' },
    })
    expect(updateRes.ok()).toBeTruthy()

    // Cleanup
    await apiRequest(request, 'DELETE', `/api/technicians/technicians/${techId}/certifications?id=${certId}`, { token })
  })
})
