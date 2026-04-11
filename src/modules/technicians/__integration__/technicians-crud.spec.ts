/**
 * Technician CRUD API integration tests
 * Covers: list, create, update, delete, skill filter, unauthorized access
 */
import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '@open-mercato/core/helpers/integration/api'

test.describe('Technicians CRUD API', () => {
  let token: string

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'admin')
  })

  async function getFirstStaffMemberId(request: any): Promise<string> {
    const res = await apiRequest(request, 'GET', '/api/staff/team-members?page=1&pageSize=1', { token })
    const body = await res.json()
    const items = body?.items ?? body?.result?.items ?? []
    if (items.length === 0) throw new Error('No staff members found for test setup')
    return items[0].id ?? items[0].staff_member_id
  }

  async function deleteTechnicianIfExists(request: any, id: string | null) {
    if (!id) return
    try { await apiRequest(request, 'DELETE', `/api/technicians/technicians?id=${id}`, { token }) } catch { /* cleanup */ }
  }

  test('list technicians with pagination', async ({ request }) => {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=10', { token })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('totalCount')
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('create and retrieve technician', async ({ request }) => {
    let techId: string | null = null
    try {
      const staffMemberId = await getFirstStaffMemberId(request)

      const createRes = await apiRequest(request, 'POST', '/api/technicians/technicians', {
        token,
        data: {
          staff_member_id: staffMemberId,
          is_active: true,
          display_name: 'QA Test Technician',
          location_status: 'in_office',
          skills: ['Electrical'],
        },
      })
      // May fail with 409 if technician already exists for this staff member
      if (createRes.status() === 409) {
        test.skip()
        return
      }
      expect(createRes.ok()).toBeTruthy()
      const createBody = await createRes.json()
      techId = createBody.id

      const listRes = await apiRequest(request, 'GET', `/api/technicians/technicians?id=${techId}`, { token })
      expect(listRes.ok()).toBeTruthy()
      const listBody = await listRes.json()
      const found = listBody.items?.find((item: any) => item.id === techId)
      expect(found).toBeDefined()
      expect(found.isActive).toBe(true)
    } finally {
      await deleteTechnicianIfExists(request, techId)
    }
  })

  test('update technician fields', async ({ request }) => {
    const listRes = await apiRequest(request, 'GET', '/api/technicians/technicians?page=1&pageSize=1', { token })
    const items = (await listRes.json())?.items ?? []
    if (items.length === 0) { test.skip(); return }
    const id = items[0].id

    const updateRes = await apiRequest(request, 'PUT', '/api/technicians/technicians', {
      token,
      data: { id, notes: `QA update ${Date.now()}` },
    })
    expect(updateRes.ok()).toBeTruthy()
    expect((await updateRes.json()).ok).toBe(true)
  })

  test('filter technicians by skill', async ({ request }) => {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians?skill=Electrical', { token })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('unauthorized access rejected', async ({ request }) => {
    const res = await apiRequest(request, 'GET', '/api/technicians/technicians', { token: 'invalid-token' })
    expect(res.ok()).toBeFalsy()
  })
})
